<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, Arial, sans-serif; color: #0f172a; font-size: 13px; }
        .wrap { border: 1px solid #334155; border-radius: 8px; padding: 20px; }
        .title { font-size: 19px; font-weight: 800; text-align: center; margin-bottom: 14px; }
        .line { margin: 8px 0; }
        .strong { font-weight: 700; }
        .sig { margin-top: 36px; width: 240px; border-top: 1px solid #94a3b8; padding-top: 6px; }
    </style>
</head>
<body>
<div class="wrap">
    <div class="title">Lettre d'Affectation de Stage Obligatoire</div>
    <div class="line">Date: {{ $today }}</div>
    <div class="line">Nous confirmons que l'étudiant <span class="strong">{{ $row->student?->user?->name }}</span> est autorisé à effectuer son stage.</div>
    <div class="line"><span class="strong">Type:</span> {{ $row->internship_type }}</div>
    <div class="line"><span class="strong">Société:</span> {{ $row->company_name }}</div>
    <div class="line"><span class="strong">Projet:</span> {{ $row->project_name ?: '—' }}</div>
    <div class="line"><span class="strong">Période:</span> {{ optional($row->start_date)->toDateString() }} → {{ optional($row->end_date)->toDateString() }}</div>
    <div class="line"><span class="strong">Classe:</span> {{ $row->classe?->name }} ({{ $row->classe?->departement }})</div>
    <div class="line"><span class="strong">Binôme:</span> {{ $row->teammateStudent?->user?->name ?: 'Aucun' }}</div>
    <div class="line"><span class="strong">Date limite rapport:</span> {{ optional($row->deadline_rapport)->toDateString() ?: '—' }}</div>
    <div class="line"><span class="strong">Date limite attestation:</span> {{ optional($row->deadline_attestation)->toDateString() ?: '—' }}</div>

    <div class="sig">Directeur de stage (signature/cachet)</div>
</div>
</body>
</html>
