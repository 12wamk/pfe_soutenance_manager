<#
.SYNOPSIS
  Installe une tâche planifiée Windows qui exécute le script de rappels/expiration
  des invitations jury toutes les heures.

.DESCRIPTION
  À exécuter UNE SEULE FOIS, dans un PowerShell lancé "En tant qu'administrateur".
  Adaptez les deux chemins ci-dessous si votre installation XAMPP ou le chemin
  du projet diffère de la configuration par défaut.

.EXEMPLE
  cd C:\xampp\htdocs\pfe-soutenance-manager\backend\scripts
  .\installer-tache-planifiee.ps1
#>

$cheminPhp = "C:\xampp\php\php.exe"
$cheminScript = "C:\xampp\htdocs\pfe-soutenance-manager\backend\api\jury\cron-rappels-expiration.php"
$nomTache = "ENETCOM-RappelsExpirationJury"

if (!(Test-Path $cheminPhp)) {
    Write-Host "ERREUR : php.exe introuvable à '$cheminPhp'. Modifiez la variable `$cheminPhp` dans ce script." -ForegroundColor Red
    exit 1
}
if (!(Test-Path $cheminScript)) {
    Write-Host "ERREUR : script introuvable à '$cheminScript'. Vérifiez que le projet est bien copié dans htdocs." -ForegroundColor Red
    exit 1
}

# Supprime une éventuelle tâche existante du même nom avant de la recréer
Unregister-ScheduledTask -TaskName $nomTache -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $cheminPhp -Argument "`"$cheminScript`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $nomTache -Action $action -Trigger $trigger -Settings $settings -Description "Rappels et expiration des invitations jury - ENET'COM" | Out-Null

Write-Host "✅ Tâche planifiée '$nomTache' installée avec succès (exécution toutes les heures)." -ForegroundColor Green
Write-Host "   Vérifiable dans : Planificateur de tâches Windows > Bibliothèque du Planificateur de tâches"
Write-Host ""
Write-Host "Pour tester immédiatement l'exécution manuelle :" -ForegroundColor Yellow
Write-Host "   Start-ScheduledTask -TaskName '$nomTache'"
Write-Host ""
Write-Host "Pour supprimer cette tâche plus tard :" -ForegroundColor Yellow
Write-Host "   Unregister-ScheduledTask -TaskName '$nomTache' -Confirm:`$false"
