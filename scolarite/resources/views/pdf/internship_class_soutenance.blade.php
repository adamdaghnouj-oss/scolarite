<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Soutenances de stage — classe</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #111827; font-size: 10px; }
        h1 { margin: 0 0 6px 0; font-size: 17px; }
        .meta { margin-bottom: 10px; color: #374151; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 5px 6px; }
        th { background: #f3f4f6; text-align: left; font-weight: 700; }
        td.num { text-align: center; }
    </style>
</head>
<body>
    <h1>Planning des soutenances de stage</h1>
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
            <th>Type</th>
            <th>Société</th>
            <th>Date soutenance</th>
            <th>Jury (professeurs)</th>
            <th class="num">Publié étudiants</th>
        </tr>
        </thead>
        <tbody>
        @forelse($rows as $row)
            <tr>
                <td>{{ $row['student_name'] ?? '—' }}</td>
                <td>{{ $row['internship_type'] ?? '—' }}</td>
                <td>{{ $row['company_name'] ?? '—' }}</td>
                <td>{{ $row['soutenance_date'] ?? '—' }}</td>
                <td>{{ $row['jury'] ?? '—' }}</td>
                <td class="num">{{ $row['published_label'] ?? '—' }}</td>
            </tr>
        @empty
            <tr>
                <td colspan="6">Aucune demande éligible pour cette classe.</td>
            </tr>
        @endforelse
        </tbody>
    </table>
</body>
</html>
