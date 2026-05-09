<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: DejaVu Sans, Arial, sans-serif; color: #0f172a; font-size: 13px; }
        .box { border: 1px solid #334155; border-radius: 8px; padding: 18px; }
        .title { font-size: 20px; font-weight: 800; margin-bottom: 12px; text-align: center; }
        .line { margin: 8px 0; }
        .lbl { font-weight: 700; }
        .sig { margin-top: 36px; display: flex; justify-content: space-between; }
        .sig-col { width: 45%; border-top: 1px solid #94a3b8; padding-top: 6px; }
    </style>
</head>
<body>
    <div class="box">
        <div class="title">Demande de Stage (sans signature)</div>
        <div class="line"><span class="lbl">Date:</span> {{ $today }}</div>
        <div class="line"><span class="lbl">Etudiant:</span> {{ $studentName ?: '—' }}</div>
        <div class="line"><span class="lbl">Classe:</span> {{ $className ?: '—' }} ({{ $classDept ?: '—' }})</div>
        <div class="line"><span class="lbl">Type de stage:</span> {{ $internshipType ?: '—' }}</div>
        <div class="line"><span class="lbl">Société d'accueil:</span> {{ $companyName }}</div>
        <div class="line"><span class="lbl">Projet:</span> {{ $projectName ?: '—' }}</div>
        <div class="line"><span class="lbl">Description:</span> {{ $projectDescription ?: '—' }}</div>
        <div class="line"><span class="lbl">Période:</span> {{ $startDate }} → {{ $endDate }}</div>
        <div class="line"><span class="lbl">Binôme:</span> {{ $teammateName ?: 'Aucun' }}</div>
        <div class="sig">
            <div class="sig-col">Signature Etudiant</div>
            <div class="sig-col">Visa société / encadrant</div>
        </div>
    </div>
</body>
</html>

