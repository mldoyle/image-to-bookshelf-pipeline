"""CLI entry point for backend service operations."""

from __future__ import annotations

import typer

from .app.factory import create_app
from .config.settings import default_model_path
from .detector import SpineDetector
from .services.detector_service import build_detector_factory

app = typer.Typer(
    name="bookshelf-backend",
    help="Backend service commands for the Bookshelf application",
    add_completion=False,
)


@app.command("serve")
def serve(
    host: str = typer.Option("127.0.0.1", help="Bind host."),
    port: int = typer.Option(5000, help="Bind port."),
    model_path: str = typer.Option(default_model_path(), help="YOLO model path."),
    confidence: float = typer.Option(0.15, help="Detector confidence threshold."),
    iou_threshold: float = typer.Option(0.45, help="Detector IoU threshold."),
    device: str = typer.Option("auto", help="Detector device override."),
    classes: str = typer.Option(str(SpineDetector.BOOK_CLASS_ID), help="Comma-separated detector classes."),
) -> None:
    """Run the Flask API service."""
    parsed_classes = [int(value.strip()) for value in classes.split(",") if value.strip()]
    detector_factory = build_detector_factory(
        model_path=model_path,
        confidence=confidence,
        iou_threshold=iou_threshold,
        device=device,
        classes=parsed_classes or None,
    )
    flask_app = create_app(detector_factory=detector_factory)
    flask_app.run(host=host, port=port, debug=False)


def main() -> None:
    """Entry point for console scripts."""
    app()


if __name__ == "__main__":
    main()
