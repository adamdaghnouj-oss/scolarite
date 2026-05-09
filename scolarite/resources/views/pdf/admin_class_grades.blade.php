<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Class Grades Export</title>
    <style>
        body { font-family: DejaVu Sans, sans-serif; color: #111827; font-size: 11px; }
        h1 { margin: 0 0 6px 0; font-size: 18px; }
        .meta { margin-bottom: 12px; color: #374151; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 6px 7px; }
        th { background: #f3f4f6; text-align: left; font-weight: 700; }
        td.num { text-align: center; }
    </style>
</head>
<body>
    <h1>Relevé des notes de classe</h1>
    <div class="meta">
        Classe: <strong>{{ $classe['name'] ?? '-' }}</strong>
        @if(!empty($classe['annee_scolaire']))
            — Année scolaire: <strong>{{ $classe['annee_scolaire'] }}</strong>
        @endif
    </div>

    <table>
        <thead>
        <tr>
            <th>Etudiant</th>
            <th>Matricule</th>
            @foreach($panierMeta as $meta)
                <th>{{ $meta['name'] }}</th>
            @endforeach
            <th>Moyenne semestrielle</th>
        </tr>
        </thead>
        <tbody>
        @forelse($students as $row)
            @php
                $byPanier = [];
                foreach (($row['paniers'] ?? []) as $p) {
                    $byPanier[(string)($p['panier_id'] ?? '')] = $p['moyenne_matiere'] ?? null;
                }
            @endphp
            <tr>
                <td>{{ $row['name'] ?? '-' }}</td>
                <td>{{ $row['matricule'] ?? '-' }}</td>
                @foreach($panierMeta as $meta)
                    @php $val = $byPanier[(string)($meta['id'] ?? '')] ?? null; @endphp
                    <td class="num">{{ $val !== null ? number_format((float)$val, 2, '.', '') : '—' }}</td>
                @endforeach
                <td class="num">
                    {{ isset($row['moyenne_semestrielle']) && $row['moyenne_semestrielle'] !== null ? number_format((float)$row['moyenne_semestrielle'], 2, '.', '') : '—' }}
                </td>
            </tr>
        @empty
            <tr>
                <td colspan="{{ 3 + count($panierMeta) }}">Aucune donnée.</td>
            </tr>
        @endforelse
        </tbody>
    </table>
</body>
</html>

