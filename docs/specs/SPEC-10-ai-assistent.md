# SPEC-10 – Feature: AI-Buchungsassistent

**Phase:** 3 (nach SPEC-09) · **Aufwand:** iterativ · **Abhängigkeiten:** SPEC-09 (teilt `Services/Ai|Ocr`-Infrastruktur, API-Key, Modul-Flags)

## Ziel
AI unterstützt die Buchhaltung mit **Vorschlägen** – sie bucht nie selbstständig. Ausbaustufen nach Nutzen/Risiko sortiert; jede Stufe einzeln shippen.

## Stufe 1: Kontierungsvorschlag (Start hier)
- Input: Belegdaten (aus OCR oder manuell) + Kontext: Tenant-Kontenplan (Codes+Namen), letzte ~20 Buchungen desselben Lieferanten, Steuer-Codes.
- Output (JSON, validiert): `{ gegenkonto_code, tax_key, kostenstelle?, kostentraeger?, konfidenz, begruendung }`.
- Anzeige in `BelegCreate`/`BookingMask` als Vorschlag-Chip mit Begründung; Übernahme per Klick. Event `ai_suggestion_applied` ins Audit-Log (inkl. Vorschlag + finaler Wahl → Datenbasis für Qualitätsmessung).
- Implementierung: `app/Services/Ai/AccountSuggestionService` hinter Interface; Modell konfigurierbar (Standard: Claude, aktuelles Modell in `config/services.php` pflegen, nicht hardcoden). Aufruf **synchron mit kurzem Timeout (~5 s)** und stillem Fallback (kein Vorschlag ist ok) – kein Blocker im Formular.

## Stufe 2: Anomalie-Hinweise
- Regelbasiert + AI: mögliche Dublette (gleicher Lieferant, Betrag, ±3 Tage), ungewöhnlicher Betrag vs. Historie, USt-Satz passt nicht zum Konto.
- Nightly-Job pro Tenant → Hinweise-Tabelle `insights` (tenant-scoped, mit Transformer!), Dashboard-Widget „Prüfen empfohlen“.

## Stufe 3: Chat-Auswertungen („Wie hoch waren meine Fahrzeugkosten in Q2?“)
- **Kein direkter SQL-Zugriff des Modells.** Stattdessen Tool-Use gegen die bestehenden Report-Endpunkte (`trial-balance`, `account-movements`, `profit-loss`, Projekt-Reports aus SPEC-08) – das Modell darf nur diese Tools mit validierten Parametern aufrufen; Tenant-Kontext kommt server-seitig aus dem JWT, nie aus dem Prompt.
- Eigener Endpoint `POST /api/ai/chat` (Rollen owner/buchhalter, Rate-Limit), Streaming optional später.

## Querschnitt (alle Stufen)
- Modul-Flag `company_settings.module_ai_enabled` (Opt-in pro Tenant), Datenschutzhinweis im Settings-UI.
- Kosten-/Nutzungslog je Tenant (`ai_usage_logs`: tokens, feature, model, cost) – Grundlage für Limits/Abrechnung; tenant-scoped → Transformer nicht vergessen.
- Prompt-Injection-Härtung: Belegtexte/Nutzereingaben sind **Daten**, nie Instruktionen – System-Prompt strikt, Ausgaben schema-validieren, keine Tool-Aufrufe außerhalb der Whitelist.
- Referenz für API-Nutzung: `claude-api`-Skill/Doku (Modell-IDs, Tool-Use, Caching) beim Implementieren konsultieren.

## Akzeptanzkriterien (Stufe 1)
- [ ] Vorschlag erscheint < 5 s oder gar nicht (kein Formular-Blocking, Test mit gemocktem Provider)
- [ ] Vorschlag referenziert nur Konten/Steuer-Codes des eigenen Tenants (Validierung nach LLM-Antwort!)
- [ ] Übernahme + Ablehnung werden im Audit-Log erfasst
- [ ] Feature vollständig deaktivierbar (Flag aus → keine API-Calls, UI-Elemente weg)
- [ ] Provider-Ausfall → App funktioniert unverändert (Fallback-Test)

## Backup-Impact
- Neue tenant-scoped Tabellen (`insights`, `ai_usage_logs`) → Transformer + Registry + Roundtrip-Erweiterung (Schutzregel 1). `ai_usage_logs` ggf. bewusst vom Export ausschließen (operative Telemetrie) – Entscheidung im PR dokumentieren.
- Keine Änderungen an bestehenden Export-Formaten. ⚠️ nur bei den neuen Tabellen.
