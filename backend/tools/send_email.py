"""
Stuur een e-mail via SMTP (Gmail of andere provider).
Sonja gebruikt deze tool o.a. om de output van geplande taken naar de maillijst te sturen.
De body wordt als markdown verwacht; we zetten het om naar HTML zodat opmaak (vet, lijstjes, etc.) goed in de mail komt.

Zet in .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM.
Gmail: smtp.gmail.com, port 465 (SSL) of 587 (TLS), app password voor SMTP_PASSWORD.
"""

import os
import smtplib
import markdown
from email.mime.text import MIMEText
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field


def _default_from() -> str:
    return os.getenv("EMAIL_FROM", "Sonja AFAS <bmj.keijzer@gmail.com>").strip()


class SendEmailInput(BaseModel):
    to: list[str] = Field(description="Lijst van e-mailadressen (bijv. ['jan@afas.nl', 'marie@afas.nl'])")
    subject: str = Field(description="Onderwerp van de e-mail")
    body: str = Field(description="Inhoud van de e-mail (markdown; wordt als HTML verzonden voor opmaak)")


class SendEmailTool(BaseTool):
    name: str = "send_email"
    description: str = (
        "Stuur een e-mail naar een of meer adressen. Gebruik voor het versturen van resultaten van geplande taken "
        "of wanneer de gebruiker vraagt iets per e-mail te sturen. Geef to (lijst adressen), subject en body op. "
        "Body mag markdown zijn (**vet**, lijstjes, etc.); wordt als HTML verzonden zodat opmaak goed in de mail staat."
    )
    args_schema: Type[BaseModel] = SendEmailInput

    def _run(self, to: list[str], subject: str, body: str) -> str:
        if not to:
            return "Fout: geen ontvangers opgegeven."
        host = os.getenv("SMTP_HOST", "").strip()
        port_str = os.getenv("SMTP_PORT", "465").strip()
        user = os.getenv("SMTP_USER", "").strip()
        password = os.getenv("SMTP_PASSWORD", "").strip()
        if not all([host, user, password]):
            return "E-mail is niet geconfigureerd (SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env)."
        try:
            port = int(port_str)
        except ValueError:
            port = 465
        from_addr = _default_from()
        html_body = markdown.markdown(
            body,
            extensions=["extra", "nl2br"],  # o.a. tabellen, fenced code; nl2br = newlines naar <br>
        )
        msg = MIMEText(html_body, "html", "utf-8")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = ", ".join(to)
        try:
            if port == 465:
                with smtplib.SMTP_SSL(host, port) as server:
                    server.login(user, password)
                    server.sendmail(user, to, msg.as_string())
            else:
                with smtplib.SMTP(host, port) as server:
                    server.starttls()
                    server.login(user, password)
                    server.sendmail(user, to, msg.as_string())
            return f"E-mail verzonden naar {', '.join(to)}."
        except Exception as e:
            return f"Kon e-mail niet versturen: {e}"


send_email_tool = SendEmailTool()
