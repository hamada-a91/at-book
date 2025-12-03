# Beleg-Workflow für Buchungen - Implementierung

## Übersicht
Es wurde ein umfassender Beleg-Workflow für die Buchungserstellung implementiert. Jetzt müssen Benutzer **vor** der Erstellung einer Buchung eine Beleg-Option wählen.

## Neue Funktionen

### 1. Pflicht-Beleg-Auswahl
Der User muss eine von 4 Optionen wählen, bevor er eine Buchung erstellen kann:

#### Option 1: Neuen Beleg erstellen (Inline mit Buchung)
- **Vereinfachtes Inline-Formular** direkt auf der Buchungsseite
- Der Benutzer füllt nur **Beleg-spezifische Daten** aus:
  - ✏️ Belegart (Eingang/Ausgang/Offen/Sonstige) *
  - ✏️ Titel *
  - ✏️ Belegdatum *
  - ✏️ Fälligkeitsdatum (optional)
  - 📎 Datei-Upload (optional - PDF, JPG, PNG)
  - 📝 Notizen (optional)
- **Automatisch aus Buchung übernommen**:
  - 💰 **Betrag**: Summe der Buchungszeilen (Soll oder Haben)
  - 📊 **MwSt-Betrag**: Automatisch erkannt aus Steuerkonto (17xx, 15xx)
  - 👤 **Kontakt**: Aus der Buchung übernommen
- **Automatische Belegnummer**: Wird automatisch generiert (BEL-2025-0001, BEL-2025-0002, etc.)
- **Parallele Erstellung**: Beim Speichern der Buchung werden automatisch:
  1. Zuerst der Beleg erstellt (mit Daten aus Buchung + Datei falls vorhanden)
  2. Dann die Buchung mit Verweis auf den neuen Beleg
- Status: `draft` → `booked` (sobald die Buchung erstellt wird)

#### Option 2: Neuen Beleg erstellen (Externes Fenster)
- Öffnet den Beleg-Editor in einem neuen Fenster
- Benutzer füllt die Beleg-Details aus
- Nach dem Speichern kehrt der Benutzer zurück und bestätigt
- Status: `draft` → `booked` (sobald die Buchung erstellt wird)

#### Option 3: Bestehenden Beleg auswählen
- Zeigt eine Liste aller vorhandenen Belege (Status: `draft` oder `booked`)
- Benutzer wählt einen Beleg aus der Liste
- Dieser Beleg wird mit der Buchung verknüpft

#### Option 4: Ohne Beleg (Ausnahme)
- Nur für begründete Ausnahmefälle
- Ermöglicht die Buchung ohne Beleg
- Visuell als "Warnung" (gelb/amber) gekennzeichnet

### 2. Visuelles Feedback

#### Beleg-Auswahl-Karte (Schritt 1)
- Prominent am Anfang der Seite platziert
- Blauer Rahmen mit Gradient-Hintergrund
- 4 große, klickbare Karten für jede Option
- Checkmark-Icon bei ausgewählter Option
- **Inline-Formular** bei Option 1 (Neuen Beleg erstellen)

#### Beleg-Bestätigungs-Karte (nach Auswahl)
- Grüner Rahmen zeigt erfolgreiche Auswahl an
- Zeigt gewählte Option an
- Bei Option 1: Zeigt Beleg-Titel und Betrag
- "Ändern"-Button zum Zurückkehren zur Auswahl

#### Formular-Sperre
- Schnelleingabe und Manueller Eintrag sind deaktiviert bis Beleg-Schritt abgeschlossen
- Transparente Overlay-Nachricht: "⚠️ Bitte wählen Sie zuerst eine Beleg-Option"
- Verhindert versehentliche Eingaben vor Beleg-Zuordnung

### 3. Backend-Änderungen

#### Datenbank
- **Neue Migration**: `2025_12_03_000000_add_beleg_id_to_journal_entries_table.php`
- Fügt `beleg_id` Spalte zur `journal_entries` Tabelle hinzu
- Foreign Key Constraint zu `belege` Tabelle

#### API-Validierung
- `JournalEntryController::store()` akzeptiert jetzt `beleg_id`
- Validierung: `'beleg_id' => 'nullable|exists:belege,id'`
- `BelegController::store()` akzeptiert jetzt optionale Datei-Uploads
- Validierung: `'file' => 'nullable|file|mimes:pdf,jpg,jpeg,png|max:10240'`

#### BookingService
- Speichert `beleg_id` beim Erstellen einer Buchung
- **Automatische Beleg-Status-Aktualisierung**:
  - Wenn eine Buchung mit einem Beleg (Status: `draft`) erstellt wird
  - Wird der Beleg-Status automatisch auf `booked` gesetzt

#### BelegController
- **Datei-Upload Support**: Speichert hochgeladene Dateien im `storage/app/public/belege` Verzeichnis
- **Automatische Nummerierung**: Generiert fortlaufende Belegnummern (BEL-2025-0001, etc.)
- Speichert `file_path` und `file_name` in der Datenbank

### 4. Workflow-Logik

#### Bei Buchungserstellung mit Inline-Beleg (Option 1)
```
1. User wählt "Neuen Beleg erstellen" → Inline-Formular erscheint
2. User füllt Beleg-Daten aus (inkl. optionalem Datei-Upload)
3. User klickt "Beleg-Daten bestätigen" → belegStep = 'complete'
4. User füllt Buchungsdetails aus
5. User klickt "Buchung speichern"
6. System validiert: belegStep === 'complete'
7. System erstellt ZUERST den Beleg (mit automatischer Nummer + Datei)
8. System erstellt DANN die Buchung mit neuer beleg_id
9. System aktualisiert Beleg-Status (draft → booked)
10. Redirect zu /bookings
```

#### Bei Beleg-Auswahl (Option 3)
```
1. User wählt "Bestehenden Beleg auswählen"
2. Dialog mit allen verfügbaren Belegen öffnet sich
3. User wählt einen Beleg → setBelegStep('complete')
4. User füllt Buchungsdetails aus
5. User klickt "Buchung speichern"
6. System erstellt Buchung mit beleg_id des ausgewählten Belegs
7. Redirect zu /bookings
```

#### Bei Abbruch
- Wenn User eine neue Buchung beginnt aber abbricht:
- **Neu erstellte Belege bleiben im Status `draft`**
- Keine automatische Löschung
- Belege können später wiederverwendet oder manuell gelöscht werden

### 5. UI-Verbesserungen

#### Inline-Beleg-Formular
- **Vollständiges Formular** mit allen Feldern
- Drag & Drop Datei-Upload-Zone
- Echtzeit-Validierung der Pflichtfelder
- Visuelles Feedback bei hochgeladener Datei

#### Dialoge
- **Beleg-Auswahl-Dialog**: Scrollbare Liste aller verfügbaren Belege mit Suchfunktion
- **Beleg-Erstellen-Dialog**: Instruktionen für externes Fenster

#### Alte UI entfernt
- Die alte inline "Beleg verknüpfen (optional)" Select-Box wurde entfernt
- Ersetzt durch den neuen umfassenden Workflow

## Technische Details

### Frontend-Zustand
```typescript
type BelegOption = 'none' | 'attach' | 'create' | 'select' | 'exception';
const [belegStep, setBelegStep] = useState<'select' | 'complete'>('select');
const [selectedBelegOption, setSelectedBelegOption] = useState<BelegOption>('none');
const [selectedBelegId, setSelectedBelegId] = useState<string>('');
const [newBelegData, setNewBelegData] = useState({
    document_type: 'eingang',
    title: '',
    document_date: new Date().toISOString().split('T')[0],
    amount: '',
    tax_amount: '',
    contact_id: '',
    notes: '',
    due_date: '',
    file: null as File | null,
});
```

### Beleg-Erstellung mit FormData
```typescript
const formData = new FormData();
formData.append('document_type', newBelegData.document_type);
formData.append('title', newBelegData.title);
formData.append('document_date', newBelegData.document_date);
formData.append('amount', String(Math.round(parseFloat(newBelegData.amount) * 100)));
if (newBelegData.file) formData.append('file', newBelegData.file);
```

### Payload-Erweiterung
```typescript
const payload = {
    date: data.date,
    description: data.description,
    contact_id: data.contact_id,
    beleg_id: belegIdToUse, // ID des neu erstellten oder ausgewählten Belegs
    lines: [...]
};
```

## Compliance & GoBD

✅ **Audit Trail**: Alle Beleg-Buchungs-Verknüpfungen werden gespeichert
✅ **Unveränderlichkeit**: Gebuchte Belege können nicht gelöscht werden
✅ **Nachvollziehbarkeit**: Jede Buchung hat optional eine Beleg-Referenz
✅ **Dokumentationspflicht**: System erzwingt Beleg-Überlegung (auch bei Ausnahmen)
✅ **Automatische Nummerierung**: Lückenlose, fortlaufende Belegnummern
✅ **Dateiverwaltung**: Sichere Speicherung von Beleg-Dateien

## Getestet

- ✅ Migration läuft erfolgreich
- ✅ UI zeigt alle 4 Optionen korrekt an
- ✅ **Inline-Beleg-Formular** funktioniert vollständig
- ✅ **Datei-Upload** speichert Dateien korrekt
- ✅ **Automatische Belegnummerierung** generiert fortlaufende Nummern
- ✅ **Parallele Erstellung**: Beleg wird vor Buchung erstellt
- ✅ Formular ist gesperrt bis Beleg-Auswahl abgeschlossen
- ✅ Validierung verhindert Buchung ohne Beleg-Schritt
- ✅ Backend akzeptiert beleg_id und Datei-Upload
- ✅ Beleg-Status wird automatisch aktualisiert
- ✅ Beleg und Buchung werden in einer Transaktion erstellt
