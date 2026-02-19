"""Text extraction pipeline with a pluggable Moondream backend."""

from __future__ import annotations

import json
import logging
import os
import re
import csv
import argparse
import importlib.util
from pathlib import Path
from typing import Protocol, Sequence

from PIL import Image

try:
    from .schemas import SpineExtraction, SpineExtractionResult
except ImportError:  # pragma: no cover - supports direct script execution
    from bookshelf_scanner.schemas import SpineExtraction, SpineExtractionResult

logger = logging.getLogger(__name__)


class ExtractionBackend(Protocol):
    """Contract for interchangeable extraction backends."""

    def extract(self, spine_image: Image.Image) -> dict:
        """Return a backend response containing extracted text."""


class MoondreamBackend:
    """Moondream extraction backend with lazy model loading."""

    MODEL_REVISIONS = {
        "moondream-0.5b": "2025-01-09",
        "moondream-2b": "2025-06-21",
    }

    EXTRACTION_PROMPT = """Look at this book spine image and extract book info.

Respond with ONLY JSON in this exact format:
{"title": "The Book Title", "author": "Author Name"}

Rules:
- Extract title exactly as shown.
- If author is not visible, set author to null.
- Do not add any extra text.
"""

    def __init__(
        self,
        model_name: str = "moondream-0.5b",
        revision: str | None = None,
        device: str = "auto",
        max_new_tokens: int = 100,
        temperature: float = 0.1,
        cache_dir: str | Path | None = None,
        local_files_only: bool | None = None,
        modules_cache_dir: str | Path = ".cache/huggingface/modules",
    ) -> None:
        self.model_name = model_name
        self.revision = revision or self.MODEL_REVISIONS.get(model_name, "2025-01-09")
        self.device = self._resolve_device(device)
        self.max_new_tokens = max_new_tokens
        self.temperature = temperature
        self.local_files_only = local_files_only
        self.cache_dir = Path(cache_dir).expanduser() if cache_dir else None
        if self.cache_dir:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.modules_cache_dir = Path(modules_cache_dir).expanduser()
        self.modules_cache_dir.mkdir(parents=True, exist_ok=True)
        self._model = None
        self._model_id = self._resolve_model_id(model_name)
        self._effective_revision = None if Path(self._model_id).exists() else self.revision

    def extract(self, spine_image: Image.Image) -> dict:
        model = self._ensure_model()
        if spine_image.mode != "RGB":
            spine_image = spine_image.convert("RGB")

        response = model.query(
            spine_image,
            self.EXTRACTION_PROMPT,
            settings={
                "max_tokens": self.max_new_tokens,
                "temperature": self.temperature,
            },
        )
        if isinstance(response, str):
            return {"answer": response, "confidence": 0.0}
        if isinstance(response, dict):
            return response
        return {"answer": str(response), "confidence": 0.0}

    def _ensure_model(self):
        if self._model is not None:
            return self._model

        import torch
        import transformers
        from transformers import AutoModelForCausalLM

        version_major = int(str(transformers.__version__).split(".", 1)[0])
        if version_major >= 5:
            raise RuntimeError(
                "Moondream in this project is incompatible with transformers>=5. "
                "Install a 4.x version: `pip install \"transformers>=4.40.0,<5.0.0\"`."
            )

        self._configure_hf_cache()
        local_files_only = (
            self._is_model_cached(self._model_id)
            if self.local_files_only is None
            else self.local_files_only
        )
        if local_files_only:
            os.environ.setdefault("HF_HUB_OFFLINE", "1")
            self._ensure_moondream_revision_alias()
        dtype = torch.float32 if self.device == "cpu" else torch.float16
        logger.info(
            "Loading Moondream model %s revision=%s device=%s cache_dir=%s local_files_only=%s",
            self._model_id,
            self._effective_revision,
            self.device,
            self.cache_dir,
            local_files_only,
        )
        has_accelerate = importlib.util.find_spec("accelerate") is not None
        load_kwargs = {
            "revision": self._effective_revision,
            "trust_remote_code": True,
            "dtype": dtype,
            "cache_dir": str(self.cache_dir) if self.cache_dir else None,
            "local_files_only": local_files_only,
        }
        if has_accelerate:
            load_kwargs["device_map"] = {"": self.device}

        try:
            self._model = AutoModelForCausalLM.from_pretrained(self._model_id, **load_kwargs)
            if not has_accelerate:
                self._model = self._model.to(self.device)
        except ImportError as exc:
            if "pyvips" in str(exc).lower():
                raise RuntimeError(
                    "Moondream requires pyvips. Install with: "
                    "`pip install pyvips-binary==8.16.0 pyvips==2.2.3`"
                ) from exc
            raise
        except ValueError as exc:
            if "requires `accelerate`" in str(exc):
                raise RuntimeError(
                    "Transformers requires accelerate for device_map. "
                    "Install with: `pip install accelerate`."
                ) from exc
            raise
        return self._model

    def _configure_hf_cache(self) -> None:
        os.environ.setdefault("HF_MODULES_CACHE", str(self.modules_cache_dir))
        if self.cache_dir:
            os.environ.setdefault("HF_HUB_CACHE", str(self.cache_dir))
            os.environ.setdefault("TRANSFORMERS_CACHE", str(self.cache_dir))
        try:
            from transformers import dynamic_module_utils
            from transformers.utils import hub

            dynamic_module_utils.HF_MODULES_CACHE = str(self.modules_cache_dir)
            hub.HF_MODULES_CACHE = str(self.modules_cache_dir)
        except Exception:
            # Best-effort patching of module-level cache constants.
            pass

    def _is_model_cached(self, model_id: str) -> bool:
        model_path = Path(model_id)
        if model_path.exists():
            return True

        if "/" not in model_id:
            return False

        slug = f"models--{model_id.replace('/', '--')}"
        if self.cache_dir and (self.cache_dir / slug).exists():
            return True

        env_hub_cache = os.getenv("HF_HUB_CACHE") or os.getenv("TRANSFORMERS_CACHE")
        if env_hub_cache and (Path(env_hub_cache).expanduser() / slug).exists():
            return True

        default_hub_cache = Path.home() / ".cache" / "huggingface" / "hub"
        return (default_hub_cache / slug).exists()

    def _ensure_moondream_revision_alias(self) -> None:
        """Alias legacy tokenizer revision used by Moondream internals to cached commit."""
        if self._model_id != "vikhyatk/moondream2":
            return

        hub_cache_candidates: list[Path] = []
        if self.cache_dir:
            hub_cache_candidates.append(self.cache_dir.expanduser())
        env_hub_cache = os.getenv("HF_HUB_CACHE") or os.getenv("TRANSFORMERS_CACHE")
        if env_hub_cache:
            hub_cache_candidates.append(Path(env_hub_cache).expanduser())
        hub_cache_candidates.append(Path.home() / ".cache" / "huggingface" / "hub")

        slug = "models--vikhyatk--moondream2"
        source_ref = "2025-01-09"
        target_ref = "2024-08-26"

        for hub_cache in hub_cache_candidates:
            refs_dir = hub_cache / slug / "refs"
            src_ref_path = refs_dir / source_ref
            dst_ref_path = refs_dir / target_ref
            if not src_ref_path.exists() or dst_ref_path.exists():
                continue
            try:
                refs_dir.mkdir(parents=True, exist_ok=True)
                dst_ref_path.write_text(src_ref_path.read_text(encoding="utf-8"), encoding="utf-8")
            except OSError:
                continue
            break

    @staticmethod
    def _resolve_model_id(model_name: str) -> str:
        aliases = {
            "moondream-0.5b": "vikhyatk/moondream2",
            "moondream-2b": "vikhyatk/moondream2",
        }
        if model_name in aliases:
            return aliases[model_name]
        maybe_path = Path(model_name)
        if maybe_path.exists():
            return str(maybe_path)
        return model_name

    @staticmethod
    def _resolve_device(device: str) -> str:
        if device != "auto":
            return device

        import torch

        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
        return "cpu"


class BookExtractor:
    """Extract text from segmented spine images using a swappable backend."""

    def __init__(
        self,
        backend: str | ExtractionBackend = "moondream",
        **backend_kwargs,
    ) -> None:
        if isinstance(backend, str):
            if backend != "moondream":
                raise ValueError(f"Unsupported extraction backend: {backend}")
            self.backend: ExtractionBackend = MoondreamBackend(**backend_kwargs)
        else:
            self.backend = backend

    def extract(self, spine_image: Image.Image) -> SpineExtraction:
        """Extract structured text for one segmented spine image."""
        try:
            response = self.backend.extract(spine_image)
        except Exception as exc:
            logger.exception("Extraction backend failed")
            return SpineExtraction(
                title="[Extraction Failed]",
                author=None,
                confidence=0.0,
                raw_response=f"{type(exc).__name__}: {exc}",
            )

        answer = str(
            response.get("answer")
            or response.get("text")
            or response.get("output")
            or ""
        ).strip()
        confidence = float(
            response.get("confidence")
            or response.get("score")
            or response.get("probability")
            or 0.0
        )
        parsed = self._parse_response(answer)
        parsed.raw_response = answer
        parsed.confidence = max(0.0, min(1.0, confidence))
        return parsed

    def extract_batch(self, spine_images: Sequence[Image.Image]) -> list[SpineExtraction]:
        """Extract structured text for multiple segmented spine images."""
        return [self.extract(image) for image in spine_images]

    def extract_from_paths(self, image_paths: Sequence[str | Path]) -> list[SpineExtractionResult]:
        """Load segmented spine images from disk and extract text from each."""
        results: list[SpineExtractionResult] = []

        for index, image_path in enumerate(image_paths):
            path = Path(image_path)
            with Image.open(path) as image:
                extraction = self.extract(image.convert("RGB"))
            results.append(
                SpineExtractionResult(
                    spine_index=index,
                    image_path=path,
                    extraction=extraction,
                )
            )
        return results

    def _parse_response(self, response: str) -> SpineExtraction:
        response = response.strip()
        if not response:
            return SpineExtraction(title="[No Text Detected]", author=None)

        try:
            data = json.loads(response)
            return SpineExtraction(**data)
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

        patterns = [r"```json\s*(.*?)\s*```", r"```\s*(.*?)\s*```", r"\{[^{}]*\}"]
        for pattern in patterns:
            match = re.search(pattern, response, re.DOTALL)
            if not match:
                continue
            payload = match.group(1) if "```" in pattern else match.group(0)
            try:
                data = json.loads(payload)
                return SpineExtraction(**data)
            except (json.JSONDecodeError, TypeError, ValueError):
                continue

        title_match = re.search(r'"title"\s*:\s*"([^"]+)"', response)
        author_match = re.search(r'"author"\s*:\s*"([^"]+)"', response)
        author_null = re.search(r'"author"\s*:\s*null', response)
        if title_match:
            author = None if author_null else (author_match.group(1) if author_match else None)
            return SpineExtraction(title=title_match.group(1), author=author)

        lines = [line.strip() for line in response.splitlines() if line.strip()]
        if lines:
            title = re.sub(r"[{}\":\[\]]", "", lines[0]).strip()[:500]
            if title:
                return SpineExtraction(title=title, author=None)

        return SpineExtraction(title="[Could Not Parse]", author=None)


def _collect_image_paths(input_path: Path) -> list[Path]:
    if input_path.is_file():
        return [input_path]
    if not input_path.is_dir():
        raise FileNotFoundError(f"Input path not found: {input_path}")

    patterns = ("*.jpg", "*.jpeg", "*.png", "*.webp", "*.bmp")
    paths: list[Path] = []
    for pattern in patterns:
        paths.extend(input_path.glob(pattern))
        paths.extend(input_path.glob(pattern.upper()))
    return sorted(set(paths))


def _write_results_csv(output_path: Path, results: Sequence[SpineExtractionResult]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["spine_index", "image_path", "title", "author", "confidence", "raw_response"],
        )
        writer.writeheader()
        for row in results:
            writer.writerow(
                {
                    "spine_index": row.spine_index,
                    "image_path": str(row.image_path),
                    "title": row.extraction.title,
                    "author": row.extraction.author or "",
                    "confidence": f"{row.extraction.confidence:.4f}",
                    "raw_response": row.extraction.raw_response or "",
                }
            )


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run Moondream extraction on spine image(s).")
    parser.add_argument("input", type=Path, help="Input spine image path or directory of spine images.")
    parser.add_argument("--limit", type=int, default=None, help="Only process first N images.")
    parser.add_argument("--output", type=Path, default=None, help="Optional CSV output path.")
    parser.add_argument("--model-name", default="moondream-0.5b", help="Model name, repo ID, or local path.")
    parser.add_argument("--revision", default=None, help="Model revision (if loading from repo).")
    parser.add_argument("--device", default="auto", help="Device: auto, cpu, cuda, or mps.")
    parser.add_argument("--max-new-tokens", type=int, default=100, help="Max generated tokens.")
    parser.add_argument("--temperature", type=float, default=0.1, help="Decoding temperature.")
    parser.add_argument("--cache-dir", type=Path, default=None, help="Optional Hugging Face model cache directory.")
    parser.add_argument(
        "--modules-cache-dir",
        type=Path,
        default=Path(".cache/huggingface/modules"),
        help="Cache directory for remote model python modules.",
    )
    parser.add_argument(
        "--local-files-only",
        action="store_true",
        help="Force offline mode and only use locally cached model files.",
    )
    return parser


def _run_cli() -> int:
    parser = _build_arg_parser()
    args = parser.parse_args()

    paths = _collect_image_paths(args.input)
    if not paths:
        print(f"No image files found in: {args.input}")
        return 1

    if args.limit is not None:
        if args.limit <= 0:
            print("--limit must be greater than 0.")
            return 1
        paths = paths[: args.limit]

    extractor = BookExtractor(
        model_name=args.model_name,
        revision=args.revision,
        device=args.device,
        max_new_tokens=args.max_new_tokens,
        temperature=args.temperature,
        cache_dir=args.cache_dir,
        modules_cache_dir=args.modules_cache_dir,
        local_files_only=True if args.local_files_only else None,
    )
    results = extractor.extract_from_paths(paths)

    for row in results:
        extraction = row.extraction
        print(
            f"[{row.spine_index:02d}] {row.image_path.name} | "
            f"title={extraction.title!r} | author={extraction.author!r} | "
            f"confidence={extraction.confidence:.2f}"
        )

    if args.output:
        _write_results_csv(args.output, results)
        print(f"Wrote: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(_run_cli())
