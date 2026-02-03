"""CLI entry point for bookshelf scanner (to be implemented)."""

import typer

app = typer.Typer(
    name="bookshelf-scanner",
    help="Scan bookshelves and export to Goodreads/StoryGraph CSV",
    add_completion=False,
)


@app.command()
def scan() -> None:
    """Scan a bookshelf image (implementation pending)."""
    raise NotImplementedError("CLI scan command is not implemented yet.")


def main() -> None:
    """Entry point."""
    app()


if __name__ == "__main__":
    main()
