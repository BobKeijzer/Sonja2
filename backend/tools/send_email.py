"""
Stuur een e-mail naar opgegeven adressen.
Sonja gebruikt deze tool o.a. om de output van geplande taken naar de maillijst te sturen.

Afzender = Sonja's eigen adres: zet in .env EMAIL_FROM (of SONJA_EMAIL), bijv. sonja@afas.nl.
SMTP: SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASSWORD.
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field


class SendEmailInput(BaseModel):
    to: list[str] = Field(description="Lijst van e-mailadressen (bijv. ['jan@afas.nl', 'marie@afas.nl'])")
    subject: str = Field(description="Onderwerp van de e-mail")
    body: str = Field(description="Inhoud van de e-mail (tekst)")


class SendEmailTool(BaseTool):
    name: str = "send_email"
    description: str = (
        "Stuur een e-mail naar een of meer adressen. Gebruik voor het versturen van resultaten van geplande taken "
        "of wanneer de gebruiker vraagt iets per e-mail te sturen. Geef to (lijst adressen), subject en body op."
    )
    args_schema: Type[BaseModel] = SendEmailInput

    def _run(self, to: list[str], subject: str, body: str) -> str:
        if not to:
            return "Fout: geen ontvangers opgegeven."
        host = os.getenv("SMTP_HOST")
        user = os.getenv("SMTP_USER")
        password = os.getenv("SMTP_PASSWORD")
        # Sonja's afzenderadres: EMAIL_FROM of SONJA_EMAIL (anders SMTP_USER)
        from_addr = os.getenv("EMAIL_FROM") or os.getenv("SONJA_EMAIL") or user or "sonja@afas.nl"
        port = int(os.getenv("SMTP_PORT", "587"))
        if not host or not user or not password:
            return "E-mail is niet geconfigureerd (SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env)."
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = ", ".join(to)
        msg.attach(MIMEText(body, "plain", "utf-8"))
        try:
            with smtplib.SMTP(host, port) as s:
                s.starttls()
                s.login(user, password)
                s.sendmail(from_addr, to, msg.as_string())
            return f"E-mail verzonden naar {', '.join(to)}."
        except Exception as e:
            return f"Kon e-mail niet versturen: {e}"


send_email_tool = SendEmailTool()
