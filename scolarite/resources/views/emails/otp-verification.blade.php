<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vérification par code OTP</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .email-wrapper {
            background-color: #ffffff;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 30px;
            text-align: center;
        }
        .otp-code {
            background-color: #f8f9fa;
            border: 2px dashed #667eea;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 8px;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        .warning {
            color: #dc3545;
            font-size: 14px;
            margin-top: 15px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="email-wrapper">
            <div class="header">
                <h1>🎓 Université</h1>
            </div>
            <div class="content">
                <h2>Bonjour {{ $userName }},</h2>
                <p>Merci de vous être inscrit sur la plateforme universitaire.</p>
                <p>Pour vérifier votre adresse e-mail, veuillez utiliser le code de vérification suivant :</p>
                
                <div class="otp-code">{{ $otpCode }}</div>
                
                <p>Ce code est valide pendant <strong>15 minutes</strong>.</p>
                
                <p class="warning">
                    ⚠️ Ne partagez pas ce code avec quelqu'un.<br>
                    Notre équipe ne vous demandera jamais ce code.
                </p>
            </div>
            <div class="footer">
                <p>Cet e-mail a été envoyé automatiquement, merci de ne pas y répondre.</p>
                <p>&copy; {{ date('Y') }} Université - Tous droits réservés</p>
            </div>
        </div>
    </div>
</body>
</html>
