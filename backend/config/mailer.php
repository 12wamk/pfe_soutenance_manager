<?php
/**
 * Envoi d'emails réels via SMTP — implémentation native PHP (sans Composer,
 * sans PHPMailer téléchargé), fonctionnellement équivalente pour ce projet :
 * connexion socket + STARTTLS + AUTH LOGIN + envoi MIME, compatible Gmail SMTP.
 *
 * ---- Configuration Gmail ----
 * 1. Activez la validation en 2 étapes sur le compte Gmail expéditeur.
 * 2. Générez un "mot de passe d'application" : https://myaccount.google.com/apppasswords
 *    (le mot de passe normal du compte NE fonctionnera PAS avec le SMTP Gmail).
 * 3. Renseignez les constantes ci-dessous.
 * 4. Mettez MAIL_ENABLED à true.
 *
 * Tant que MAIL_ENABLED est à false, tous les envois sont simplement journalisés
 * (voir mail_log.txt) sans réelle tentative réseau — pratique pour développer
 * sans configuration SMTP.
 *
 * v1.13 : envoyerEmail() accepte un paramètre optionnel $ics pour joindre une
 * invitation calendrier (.ics) — rapporteur et président reçoivent directement
 * l'événement de la soutenance dans leur agenda (Google Calendar, Outlook...).
 *
 * v1.14 : $ics['method'] peut valoir 'REQUEST' (par défaut — création ou mise à
 * jour d'un événement) ou 'CANCEL' (annule l'événement déjà présent dans l'agenda
 * du destinataire). Toujours utiliser le même $ics['uid'] qu'à la création pour
 * que le client mail reconnaisse et mette à jour/supprime le bon événement, et
 * un $ics['sequence'] strictement croissant à chaque REQUEST/CANCEL ultérieur
 * sur le même uid (ex: time()) — sinon certains clients ignorent la mise à jour.
 */

define('MAIL_ENABLED', true);

define('SMTP_HOST', 'smtp.gmail.com');
define('SMTP_PORT', 587);           // 587 = STARTTLS (recommandé), 465 = SSL direct
define('SMTP_SECURE', 'tls');       // 'tls' ou 'ssl'
define('SMTP_USER', 'khaoularomdhani11@gmail.com');            // ex: votreadresse@gmail.com
define('SMTP_PASS', 'timauirykndrkzml');            // mot de passe d'application Gmail (16 caractères)
define('SMTP_FROM_EMAIL', 'khaoularomdhani11@gmail.com');      // généralement identique à SMTP_USER
define('SMTP_FROM_NAME', "ENET'COM - Gestion des Soutenances");

/**
 * Envoie un email HTML, avec en option une invitation calendrier jointe.
 *
 * $ics (optionnel) : tableau avec les clés
 *   - uid          : identifiant unique et STABLE de l'événement (ex: 'soutenance-42')
 *                    -> réutiliser le même uid lors d'une replanification ou d'une
 *                    annulation permet au client mail de mettre à jour / supprimer
 *                    l'événement existant plutôt que d'en créer un doublon.
 *   - dtstart       : DateTime de début (requis si method=REQUEST)
 *   - dtend         : DateTime de fin (requis si method=REQUEST)
 *   - summary       : titre de l'événement
 *   - description   : description
 *   - location      : lieu (salle), optionnel
 *   - method        : 'REQUEST' (défaut) ou 'CANCEL'
 *   - sequence      : entier croissant à chaque mise à jour du même uid (défaut : time())
 *
 * Retourne true si l'envoi a réussi (ou a été journalisé en mode désactivé), false sinon.
 */
function envoyerEmail($destinataireEmail, $destinataireNom, $sujet, $corpsHtml, $ics = null) {
    $icsContent = null;
    $icsMethod = 'REQUEST';
    if ($ics) {
        $icsMethod = $ics['method'] ?? 'REQUEST';
        $icsContent = genererICS($ics, $destinataireEmail, $destinataireNom);
    }

    if (!MAIL_ENABLED) {
        journaliserEmail($destinataireEmail, $sujet, '[MAIL_ENABLED=false — email non envoyé, journalisé uniquement]');
        return true;
    }
    if (!SMTP_USER || !SMTP_PASS) {
        journaliserEmail($destinataireEmail, $sujet, '[ERREUR: SMTP_USER/SMTP_PASS non configurés]');
        return false;
    }

    try {
        $ok = smtpEnvoyer(SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS,
            SMTP_FROM_EMAIL ?: SMTP_USER, SMTP_FROM_NAME, $destinataireEmail, $destinataireNom, $sujet, $corpsHtml, $icsContent, $icsMethod);
        journaliserEmail($destinataireEmail, $sujet, $ok ? 'Envoyé avec succès' : 'Échec de l\'envoi');
        return $ok;
    } catch (Exception $e) {
        journaliserEmail($destinataireEmail, $sujet, 'ERREUR: ' . $e->getMessage());
        return false;
    }
}

function journaliserEmail($destinataire, $sujet, $statut) {
    $ligne = sprintf("[%s] À: %s | Sujet: %s | %s\n", date('Y-m-d H:i:s'), $destinataire, $sujet, $statut);
    @file_put_contents(__DIR__ . '/../mail_log.txt', $ligne, FILE_APPEND);
}

/**
 * Génère le contenu texte d'une invitation calendrier au format iCalendar (RFC 5545).
 * method=REQUEST : création/mise à jour, propose Oui/Non/Peut-être côté client mail.
 * method=CANCEL   : demande au client mail de retirer l'événement de l'agenda.
 */
function genererICS($event, $attendeeEmail, $attendeeNom) {
    $fmt = fn($dt) => $dt->format('Ymd\THis');
    $maintenant = new DateTime('now', new DateTimeZone('UTC'));
    $method = $event['method'] ?? 'REQUEST';
    $estAnnulation = $method === 'CANCEL';
    $sequence = $event['sequence'] ?? time();

    $lignes = [
        'BEGIN:VCALENDAR',
        'PRODID:-//ENETCOM Soutenance Manager//FR',
        'VERSION:2.0',
        'METHOD:' . $method,
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        'UID:' . $event['uid'] . '@enetcom-soutenance-manager',
        'DTSTAMP:' . $fmt($maintenant) . 'Z',
    ];

    // Pour un CANCEL, certains clients n'exigent pas DTSTART/DTEND mais les inclure
    // quand on les connaît encore aide à identifier le bon événement.
    // Converti en UTC (suffixe Z) plutôt que de référencer TZID=Africa/Tunis sans bloc
    // VTIMEZONE : certains clients (dont Google Calendar) peuvent alors ne pas importer
    // l'heure correctement, voire ignorer l'événement. La Tunisie est en UTC+1 toute
    // l'année (pas de changement d'heure depuis 2009) : la conversion est sans ambiguïté.
    // On suppose que $event['dtstart']/['dtend'] sont des DateTime "horloge locale Tunis"
    // (ce qu'on construit côté appelant avec "new DateTime($date . ' ' . $heure)").
    if (!empty($event['dtstart'])) {
        $dtStartUtc = (clone $event['dtstart'])->setTimezone(new DateTimeZone('UTC'));
        $lignes[] = 'DTSTART:' . $fmt($dtStartUtc) . 'Z';
    }
    if (!empty($event['dtend'])) {
        $dtEndUtc = (clone $event['dtend'])->setTimezone(new DateTimeZone('UTC'));
        $lignes[] = 'DTEND:' . $fmt($dtEndUtc) . 'Z';
    }

    $lignes[] = 'SUMMARY:' . icsEchapper($event['summary']);
    $lignes[] = 'DESCRIPTION:' . icsEchapper($event['description'] ?? '');
    $lignes[] = 'LOCATION:' . icsEchapper($event['location'] ?? '');
    $lignes[] = 'ORGANIZER;CN=' . icsEchapper(SMTP_FROM_NAME) . ':mailto:' . SMTP_FROM_EMAIL;
    $lignes[] = 'ATTENDEE;CN=' . icsEchapper($attendeeNom) . ';ROLE=REQ-PARTICIPANT;PARTSTAT=' . ($estAnnulation ? 'DECLINED' : 'NEEDS-ACTION') . ';RSVP=' . ($estAnnulation ? 'FALSE' : 'TRUE') . ':mailto:' . $attendeeEmail;
    $lignes[] = 'STATUS:' . ($estAnnulation ? 'CANCELLED' : 'CONFIRMED');
    $lignes[] = 'SEQUENCE:' . (int) $sequence;
    $lignes[] = 'END:VEVENT';
    $lignes[] = 'END:VCALENDAR';

    return implode("\r\n", $lignes);
}

/** Échappe les caractères spéciaux requis par le format iCalendar (RFC 5545). */
function icsEchapper($texte) {
    return str_replace(["\\", ";", ",", "\n"], ["\\\\", "\\;", "\\,", "\\n"], (string) $texte);
}

/** Client SMTP minimal (protocole RFC 5321), avec support STARTTLS, AUTH LOGIN, et pièce jointe .ics. */
function smtpEnvoyer($host, $port, $secure, $user, $pass, $fromEmail, $fromName, $toEmail, $toName, $sujet, $corpsHtml, $icsContent = null, $icsMethod = 'REQUEST') {
    $adresse = ($secure === 'ssl' ? 'ssl://' : '') . $host;
    $socket = @stream_socket_client("$adresse:$port", $errno, $errstr, 15);
    if (!$socket) throw new Exception("Connexion SMTP impossible : $errstr ($errno)");
    stream_set_timeout($socket, 15);

    $lire = function () use ($socket) {
        $reponse = '';
        while (($ligne = fgets($socket, 515)) !== false) {
            $reponse .= $ligne;
            if (isset($ligne[3]) && $ligne[3] === ' ') break;
        }
        return $reponse;
    };
    // Écriture robuste : fwrite() sur un socket TLS peut faire une écriture PARTIELLE
    // sans erreur, surtout pour les gros messages (pièce jointe .ics en base64).
    // On boucle jusqu'à confirmation que tous les octets sont bien partis, sinon le
    // message final était tronqué en plein milieu (structure MIME cassée, pièce
    // jointe invisible côté destinataire).
    $ecrire = function ($commande) use ($socket) {
        $donnees = $commande . "\r\n";
        $longueur = strlen($donnees);
        $ecrites = 0;
        while ($ecrites < $longueur) {
            $bloc = fwrite($socket, substr($donnees, $ecrites));
            if ($bloc === false) throw new Exception('Écriture SMTP échouée (connexion interrompue)');
            if ($bloc === 0) { usleep(10000); continue; } // socket temporairement plein, on retente
            $ecrites += $bloc;
        }
    };
    $verifier = function ($reponse, $etape) {
        $code = (int) substr($reponse, 0, 3);
        if ($code >= 400) throw new Exception("Erreur SMTP à l'étape '$etape' : $reponse");
    };

    $verifier($lire(), 'connexion');
    $ecrire('EHLO localhost'); $verifier($lire(), 'EHLO');

    if ($secure === 'tls') {
        $ecrire('STARTTLS'); $verifier($lire(), 'STARTTLS');
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new Exception('Impossible d\'activer le chiffrement TLS');
        }
        $ecrire('EHLO localhost'); $verifier($lire(), 'EHLO (post-TLS)');
    }

    $ecrire('AUTH LOGIN'); $verifier($lire(), 'AUTH LOGIN');
    $ecrire(base64_encode($user)); $verifier($lire(), 'AUTH USER');
    $ecrire(base64_encode($pass)); $verifier($lire(), 'AUTH PASS');

    $ecrire("MAIL FROM: <$fromEmail>"); $verifier($lire(), 'MAIL FROM');
    $ecrire("RCPT TO: <$toEmail>"); $verifier($lire(), 'RCPT TO');
    $ecrire('DATA'); $verifier($lire(), 'DATA');

    $sujetEncode = '=?UTF-8?B?' . base64_encode($sujet) . '?=';

    if ($icsContent) {
        // Multipart : partie HTML lisible + UNE SEULE partie calendrier, encodée en
        // base64 et marquée comme pièce jointe. C'est la structure la plus largement
        // reconnue (Gmail, Outlook) — dupliquer une partie "inline" text/calendar en
        // plus d'une pièce jointe séparée est ce qui posait problème : Gmail ignorait
        // silencieusement les deux au lieu d'en afficher une correctement.
        $boundary = 'np-' . bin2hex(random_bytes(12));
        $nomFichierIcs = $icsMethod === 'CANCEL' ? 'annulation.ics' : 'invitation.ics';

        $corpsEchappe = str_replace("\n.", "\n..", $corpsHtml);

        $message = "From: $fromName <$fromEmail>\r\n"
            . "To: $toName <$toEmail>\r\n"
            . "Subject: $sujetEncode\r\n"
            . "MIME-Version: 1.0\r\n"
            . "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n"
            . "\r\n"
            . "--$boundary\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: 8bit\r\n"
            . "\r\n"
            . $corpsEchappe . "\r\n"
            . "\r\n"
            . "--$boundary\r\n"
            . "Content-Type: text/calendar; charset=UTF-8; method=$icsMethod; name=\"$nomFichierIcs\"\r\n"
            . "Content-Transfer-Encoding: base64\r\n"
            . "Content-Disposition: attachment; filename=\"$nomFichierIcs\"\r\n"
            . "\r\n"
            . chunk_split(base64_encode($icsContent))
            . "--$boundary--\r\n.";
    } else {
        $corpsEchappe = str_replace("\n.", "\n..", $corpsHtml);
        $message = "From: $fromName <$fromEmail>\r\n"
            . "To: $toName <$toEmail>\r\n"
            . "Subject: $sujetEncode\r\n"
            . "MIME-Version: 1.0\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "\r\n"
            . $corpsEchappe . "\r\n.";
    }

    $ecrire($message); $verifier($lire(), 'contenu du message');
    $ecrire('QUIT');
    fclose($socket);
    return true;
}

/** Petit gabarit HTML commun à tous les emails de la plateforme. */
function gabaritEmail($titre, $contenuHtml) {
    return <<<HTML
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a5276 0%, #2980d9 100%); padding: 24px 28px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; font-size: 18px; margin: 0;">🎓 ENET'COM — $titre</h1>
      </div>
      <div style="background: white; padding: 24px 28px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; color: #1e293b; font-size: 14px; line-height: 1.6;">
        $contenuHtml
        <p style="margin-top: 24px; font-size: 12px; color: #94a3b8;">Plateforme de Gestion des Soutenances PFE — ENET'COM</p>
      </div>
    </div>
    HTML;
}