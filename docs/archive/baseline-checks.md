# Baseline Checks

Captured on: 2026-02-27 21:05:12 UTC

## 1) Root: pytest -q
```text

==================================== ERRORS ====================================
___________________ ERROR collecting tests/test_detector.py ____________________
ImportError while importing test module '/Users/mattdoyle/Projects/image-to-bookshelf/tests/test_detector.py'.
Hint: make sure your test modules/packages have valid Python names.
Traceback:
/Library/Frameworks/Python.framework/Versions/3.13/lib/python3.13/importlib/__init__.py:88: in import_module
    return _bootstrap._gcd_import(name[level:], package, level)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
tests/test_detector.py:3: in <module>
    from bookshelf_scanner.detector import SpineDetector
src/bookshelf_scanner/detector.py:18: in <module>
    from .schemas import DetectedSpine
src/bookshelf_scanner/schemas.py:6: in <module>
    from pydantic import BaseModel, Field, field_validator
E   ModuleNotFoundError: No module named 'pydantic'
___________________ ERROR collecting tests/test_extractor.py ___________________
ImportError while importing test module '/Users/mattdoyle/Projects/image-to-bookshelf/tests/test_extractor.py'.
Hint: make sure your test modules/packages have valid Python names.
Traceback:
src/bookshelf_scanner/extractor.py:18: in <module>
    from .schemas import SpineExtraction, SpineExtractionResult
src/bookshelf_scanner/schemas.py:6: in <module>
    from pydantic import BaseModel, Field, field_validator
E   ModuleNotFoundError: No module named 'pydantic'

During handling of the above exception, another exception occurred:
/Library/Frameworks/Python.framework/Versions/3.13/lib/python3.13/importlib/__init__.py:88: in import_module
    return _bootstrap._gcd_import(name[level:], package, level)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
tests/test_extractor.py:7: in <module>
    from bookshelf_scanner.extractor import BookExtractor
src/bookshelf_scanner/extractor.py:20: in <module>
    from bookshelf_scanner.schemas import SpineExtraction, SpineExtractionResult
src/bookshelf_scanner/schemas.py:6: in <module>
    from pydantic import BaseModel, Field, field_validator
E   ModuleNotFoundError: No module named 'pydantic'
=========================== short test summary info ============================
ERROR tests/test_detector.py
ERROR tests/test_extractor.py
!!!!!!!!!!!!!!!!!!! Interrupted: 2 errors during collection !!!!!!!!!!!!!!!!!!!!
2 skipped, 2 errors in 3.05s

[exit_code] 2
```

## 2) packages/scanner-core: npm test -- --run
```text

> @image-to-bookshelf/scanner-core@0.1.0 test
> vitest run --run


 RUN  v3.2.4 /Users/mattdoyle/Projects/image-to-bookshelf/packages/scanner-core

 ✓ test/qualityScorer.test.ts (4 tests) 2ms
 ✓ test/readyStateMachine.test.ts (6 tests) 2ms
 ✓ test/iouTracker.test.ts (6 tests) 2ms

 Test Files  3 passed (3)
      Tests  16 passed (16)
   Start at  16:05:16
   Duration  161ms (transform 56ms, setup 0ms, collect 75ms, tests 6ms, environment 0ms, prepare 89ms)


[exit_code] 0
```

## 3) mobile: npm run typecheck
```text

> mobile@0.1.0 typecheck
> tsc --noEmit


[exit_code] 0
```

## 4) web-harness: npx tsc -p tsconfig.app.json --noEmit
```text

[exit_code] 0
```
