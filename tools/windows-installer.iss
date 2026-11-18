#ifndef AppVersion
  #error Define AppVersion
#endif
#ifndef StageDir
  #error Define StageDir
#endif
#ifndef OutputDir
  #error Define OutputDir
#endif
[Setup]
AppId={{A40CA540-9E36-4492-927E-BEA1DF2E74F0}
AppName=Souz BG Studio vMix
AppVersion={#AppVersion}
AppPublisher=Souz Content
AppPublisherURL=https://github.com/oSouz/BG---VMIX-EDITION
DefaultDirName={localappdata}\Programs\Souz BG Studio vMix
DefaultGroupName=Souz BG Studio vMix
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutputDir}
OutputBaseFilename=Souz-BG-Studio-vMix-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=no
UninstallDisplayName=Souz BG Studio vMix
DisableProgramGroupPage=yes
SetupLogging=yes
[Languages]
Name: brazilianportuguese; MessagesFile: compiler:Languages\BrazilianPortuguese.isl
[Tasks]
Name: desktopicon; Description: Criar atalho na área de trabalho; Flags: unchecked
[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "installer-session.ps1"; Flags: dontcopy
[Icons]
Name: "{group}\Souz BG Studio vMix"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\ABRIR-STUDIO.vbs"""; WorkingDir: "{app}"
Name: "{group}\Encerrar Souz BG Studio"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\ENCERRAR-STUDIO.vbs"""; WorkingDir: "{app}"
Name: "{group}\Desinstalar Souz BG Studio"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Souz BG Studio vMix"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\ABRIR-STUDIO.vbs"""; WorkingDir: "{app}"; Tasks: desktopicon
[Run]
Filename: "{app}\redist\NDI-Runtime.exe"; Description: "Instalar o runtime oficial NDI (se necessário)"; Flags: postinstall skipifsilent; Check: NeedsNdiRuntime
Filename: "{sys}\wscript.exe"; Parameters: """{app}\ABRIR-STUDIO.vbs"""; Description: "Abrir Souz BG Studio"; Flags: postinstall nowait skipifsilent
[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tools\installer-session.ps1"" -Action stop -Root ""{app}"""; Flags: runhidden waituntilterminated
[Code]
function NeedsNdiRuntime(): Boolean;
begin
  Result := not FileExists(ExpandConstant('{pf64}\NDI\NDI 6 Runtime\v6\Processing.NDI.Lib.x64.dll'));
end;
function PrepareToInstall(var NeedsRestart: Boolean): String;
var ResultCode: Integer;
begin
  Result := '';
  ExtractTemporaryFile('installer-session.ps1');
  if Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\installer-session.ps1') + '" -Action check -Root "' + ExpandConstant('{app}') + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    if ResultCode = 10 then Result := 'Encerre o Studio pelo atalho Encerrar Souz BG Studio antes de atualizar. A transmissão NDI não será interrompida automaticamente.';
end;
