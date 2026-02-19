"""
Haal klantgesprek-transcripts op uit opslag.

Momenteel: leest alle .txt- en .md-bestanden uit backend/call_transcripts/
en retourneert de geconcateneerde inhoud aan Sonja.
Later: ophalen via transcript-platform-API.
"""

from pathlib import Path

from crewai.tools import BaseTool


_CALL_TRANSCRIPTS_DIR = Path(__file__).resolve().parent.parent / "call_transcripts"


def _read_transcripts() -> str:
    """Lees alle .txt en .md bestanden uit call_transcripts/; retourneer één string."""
    if not _CALL_TRANSCRIPTS_DIR.is_dir():
        return "Geen call_transcripts-map gevonden. Zet transcripts in backend/call_transcripts/ (.txt of .md)."
    parts: list[str] = []
    for ext in ("*.txt", "*.md"):
        for path in sorted(_CALL_TRANSCRIPTS_DIR.glob(ext)):
            if path.is_file():
                try:
                    parts.append(f"--- {path.name} ---\n{path.read_text(encoding='utf-8', errors='replace').strip()}")
                except Exception as e:
                    parts.append(f"--- {path.name} (fout: {e}) ---\n[kon niet lezen]")
    if not parts:
        return "Geen .txt of .md bestanden in call_transcripts/. Zet daar bestanden met transcripts om te testen."
    return "\n\n".join(parts)


class GetCallTranscriptsTool(BaseTool):
    """Fetch customer call transcripts from storage."""

    name: str = "get_call_transcripts"
    description: str = (
        "Haal alle beschikbare klantgesprek-transcripts op. Retourneert de volledige tekst van alle transcripts. "
        "Gebruik wanneer iemand vraagt om call-transcripts, gesprekken met klanten, of analyses daarop. "
        "Momenteel: leest uit de lokale map call_transcripts/. Later: wordt vervangen door transcript-platform-API."
    )

    def _run(self, **kwargs: object) -> str:
        """Returns string containing all transcripts. No arguments required."""
        return _read_transcripts()


get_call_transcripts_tool = GetCallTranscriptsTool()
