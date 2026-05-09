<!doctype html>
<html lang="{{ $lang }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        @page { margin: 28px; }
        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            color: #0f172a;
            font-size: 14px;
            line-height: 1.6;
        }
        .frame {
            border: 2px solid #0f172a;
            padding: 18px 18px 22px;
            border-radius: 10px;
        }
        .top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 18px;
        }
        .brand {
            font-weight: 900;
            font-size: 18px;
            letter-spacing: -0.02em;
        }
        .meta {
            font-size: 12px;
            color: #334155;
            text-align: right;
        }
        .title {
            font-size: 22px;
            font-weight: 900;
            text-align: center;
            margin: 10px 0 18px;
            letter-spacing: -0.02em;
        }
        .content {
            margin-top: 10px;
        }
        .line {
            margin: 10px 0;
        }
        .strong {
            font-weight: 800;
        }
        .footer {
            margin-top: 26px;
            display: flex;
            justify-content: space-between;
            gap: 20px;
            font-size: 12px;
            color: #475569;
        }
        .sig {
            margin-top: 30px;
        }
        .sig-box {
            width: 240px;
            border-top: 1px solid #94a3b8;
            padding-top: 8px;
        }
        .rtl { direction: rtl; text-align: right; }
    </style>
</head>
<body class="{{ $lang === 'ar' ? 'rtl' : '' }}">
    @php
        $texts = [
            'fr' => [
                'title' => "Attestation de présence",
                'p1' => "Nous certifions que l'étudiant(e) :",
                'p2' => "est inscrit(e) et assiste régulièrement aux activités pédagogiques au sein de notre établissement.",
                'p3' => "Cette attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit.",
                'student' => "Nom de l'étudiant",
                'date' => "Date",
                'ref' => "Référence",
                'sig1' => "Administration",
                'sig2' => "Cachet & Signature",
            ],
            'en' => [
                'title' => "Attendance Certificate",
                'p1' => "This is to certify that the student:",
                'p2' => "is duly enrolled and regularly attends academic activities at our institution.",
                'p3' => "This certificate is issued upon request for any lawful purpose.",
                'student' => "Student name",
                'date' => "Date",
                'ref' => "Reference",
                'sig1' => "Administration",
                'sig2' => "Stamp & Signature",
            ],
            'ar' => [
                'title' => "شهادة حضور",
                'p1' => "نشهد أن الطالب(ة):",
                'p2' => "مسجل(ة) ويواصل(تواصل) متابعة الأنشطة البيداغوجية بانتظام داخل مؤسستنا.",
                'p3' => "سُلّمت هذه الشهادة بناءً على طلب المعني(ة) للاستظهار بها عند الحاجة.",
                'student' => "اسم الطالب",
                'date' => "التاريخ",
                'ref' => "مرجع",
                'sig1' => "الإدارة",
                'sig2' => "الختم والتوقيع",
            ],
        ][$lang] ?? $texts['fr'];
    @endphp

    <div class="frame">
        <div class="top">
            <div class="brand">Scolarité</div>
            <div class="meta">
                <div><span class="strong">{{ $texts['ref'] }}:</span> #{{ $requestId }}</div>
                <div><span class="strong">{{ $texts['date'] }}:</span> {{ $today }}</div>
            </div>
        </div>

        <div class="title">{{ $texts['title'] }}</div>

        <div class="content">
            <div class="line">{{ $texts['p1'] }}</div>
            <div class="line"><span class="strong">{{ $texts['student'] }}:</span> {{ $studentName }}</div>
            <div class="line">{{ $texts['p2'] }}</div>
            <div class="line">{{ $texts['p3'] }}</div>
        </div>

        <div class="footer">
            <div class="sig">
                <div class="sig-box">{{ $texts['sig1'] }}</div>
            </div>
            <div class="sig">
                <div class="sig-box">{{ $texts['sig2'] }}</div>
            </div>
        </div>
    </div>
</body>
</html>

