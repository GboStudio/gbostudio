<?php
/* =========================================================
   RUSH — Classements (v2 : note + filtre par niveau)
   GET  scores.php?top=50                → classement général
   GET  scores.php?top=50&niveau=NomExact→ classement d'un niveau
   POST scores.php {nom, resto, score, note, niveau, diff}
   GBO Studio
   ========================================================= */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

try {
  $db = new PDO('sqlite:' . __DIR__ . '/rush-scores.sqlite');
  $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $db->exec("CREATE TABLE IF NOT EXISTS scores(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL, resto TEXT NOT NULL,
    score INTEGER NOT NULL, niveau TEXT, diff INTEGER,
    note TEXT, date TEXT DEFAULT CURRENT_TIMESTAMP)");
  try { $db->exec("ALTER TABLE scores ADD COLUMN note TEXT"); } catch (Exception $e) { /* déjà présente */ }
} catch (Exception $e) {
  http_response_code(500); echo json_encode(["ok"=>false,"erreur"=>"base"]); exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $d = json_decode(file_get_contents('php://input'), true);
  if (!is_array($d)) { http_response_code(400); echo '{"ok":false}'; exit; }
  $nom    = mb_substr(trim($d['nom'] ?? ''), 0, 20);
  $resto  = mb_substr(trim($d['resto'] ?? ''), 0, 30);
  $score  = (int)($d['score'] ?? -1);
  $niveau = mb_substr(trim($d['niveau'] ?? ''), 0, 40);
  $diff   = max(1, min(10, (int)($d['diff'] ?? 5)));
  $note   = mb_substr(trim($d['note'] ?? ''), 0, 2);
  if ($nom === '' || $resto === '' || $score < 0 || $score > 100000) {
    http_response_code(400); echo '{"ok":false}'; exit;
  }
  $st = $db->prepare("INSERT INTO scores(nom,resto,score,niveau,diff,note) VALUES (?,?,?,?,?,?)");
  $st->execute([$nom, $resto, $score, $niveau, $diff, $note]);
  echo '{"ok":true}'; exit;
}

$top = max(1, min(100, (int)($_GET['top'] ?? 50)));
$niveauF = trim($_GET['niveau'] ?? '');
if ($niveauF !== '') {
  $st = $db->prepare(
    "SELECT nom, resto, MAX(score) AS score, niveau, diff, note
     FROM scores WHERE niveau = ?
     GROUP BY nom, resto ORDER BY score DESC LIMIT $top");
  $st->execute([$niveauF]);
} else {
  $st = $db->query(
    "SELECT nom, resto, MAX(score) AS score, niveau, diff, note
     FROM scores GROUP BY nom, resto ORDER BY score DESC LIMIT $top");
}
echo json_encode(["ok"=>true, "scores"=>$st->fetchAll(PDO::FETCH_ASSOC)]);
