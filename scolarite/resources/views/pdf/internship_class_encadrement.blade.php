<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Encadrement PFE — classe</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #111827; font-size: 10px; }
        h1 { margin: 0 0 6px 0; font-size: 17px; }
        .meta { margin-bottom: 10px; color: #374151; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 5px 6px; }
        th { background: #f3f4f6; text-align: left; font-weight: 700; }
    </style>
</head>
<body>
    <h1>Encadrement des projets PFE</h1>
    <div class="meta">
        Classe: <strong>{{ $classe['name'] ?? '-' }}</strong>
        @if(!empty($classe['annee_scolaire']))
            — Année scolaire: <strong>{{ $classe['annee_scolaire'] }}</strong>
        @endif
        — Généré le <strong>{{ $today }}</strong>
    </div>

    <table>
        <thead>
        <tr>
            <th>Étudiant</th>
            <th>Projet</th>
            <th>Société</th>
            <th>Encadrant</th>
            <th>Début encadrement</th>
            <th>Fin encadrement</th>
        </tr>
        </thead>
        <tbody>
        @forelse($rows as $row)
            <tr>
                <td>{{ $row['student_name'] ?? '—' }}</td>
                <td>{{ $row['project_name'] ?? '—' }}</td>
                <td>{{ $row['company_name'] ?? '—' }}</td>
                <td>{{ $row['encadrant_name'] ?? '—' }}</td>
                <td>{{ $row['encadrement_start'] ?? '—' }}</td>
                <td>{{ $row['encadrement_end'] ?? '—' }}</td>
            </tr>
        @empty
            <tr>
                <td colspan="6">Aucune demande PFE avec rapport accepté pour cette classe.</td>
            </tr>
        @endforelse
        </tbody>
    </table>
</body>
</html>
