<?php
/*
================================================================
PATCH: discord_bridge.php
================================================================
File ini TIDAK menggantikan get_key-free/get-key.php kamu.
Ini cuma menambahkan "jembatan" supaya discord_id ikut tersimpan
saat user lewat proses verifikasi shortlink yang SUDAH ADA.

CARA PASANG:
1. Taruh file ini di folder yang SAMA dengan get-key.php
   yaitu: get_key-free/discord_bridge.php

2. Buka get_key-free/get-key.php, cari baris paling atas:
   <?php
   ob_start();
   require "../includes/db.php";

   Tambahkan SATU baris di bawah db.php:
   require "discord_bridge.php";

   (Itu saja — tidak ada baris lain yang perlu diubah di get-key.php)

3. Bridge ini otomatis:
   - Bikin tabel discord_link_tokens (kalau belum ada)
   - Kalau ada ?discord_id=xxx di URL → simpan mapping token→discord_id
   - Kalau token sudah verify_complete → cek apakah ada discord_id terkait
     → kalau ada, otomatis insert ke discord_free_keys juga
================================================================
*/

// Pastikan tabel mapping token <-> discord_id ada
$pdo->exec("
    CREATE TABLE IF NOT EXISTS discord_link_tokens (
        token VARCHAR(64) PRIMARY KEY,
        discord_id VARCHAR(32) NOT NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_discord (discord_id)
    )
");

$pdo->exec("
    CREATE TABLE IF NOT EXISTS discord_free_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        discord_id VARCHAR(32) NOT NULL,
        key_code VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL,
        expires_at DATETIME NOT NULL,
        INDEX idx_discord (discord_id),
        INDEX idx_expires (expires_at)
    )
");

$bridge_discord_id = $_GET['discord_id'] ?? '';
$bridge_token       = $_GET['token'] ?? '';

// ── STEP 1: Kalau ada discord_id baru masuk + token baru dibuat,
//    simpan mapping-nya supaya bisa dilacak nanti ──
function discord_bridge_link_token($pdo, $token, $discord_id) {
    if (empty($token) || empty($discord_id)) return;
    $pdo->prepare("
        INSERT INTO discord_link_tokens (token, discord_id, created_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE discord_id = VALUES(discord_id)
    ")->execute([$token, $discord_id]);
}

// Kalau request ini punya discord_id, dan ada token (baik dari awal atau next_step),
// catat mapping-nya SEKARANG sebelum redirect terjadi.
if (!empty($bridge_discord_id) && !empty($bridge_token)) {
    discord_bridge_link_token($pdo, $bridge_token, $bridge_discord_id);
}

/**
 * Dipanggil manual di get-key.php SETELAH key berhasil dibuat
 * (taruh di bagian verify_complete, setelah generate_free_key dipanggil)
 * — tapi supaya tidak perlu edit get-key.php lagi, kita auto-detect di sini:
 */
function discord_bridge_finalize($pdo, $token, $key_code, $expiry) {
    if (empty($token)) return;

    // Cari discord_id yang terhubung ke token ini (dari mapping awal atau next_step manapun)
    $stmt = $pdo->prepare("SELECT discord_id FROM discord_link_tokens WHERE token = ? LIMIT 1");
    $stmt->execute([$token]);
    $row = $stmt->fetch();

    if ($row && !empty($row['discord_id'])) {
        $pdo->prepare("
            INSERT INTO discord_free_keys (discord_id, key_code, created_at, expires_at)
            VALUES (?, ?, NOW(), ?)
        ")->execute([$row['discord_id'], $key_code, $expiry]);
    }
}

// ── STEP 2: Saat status sudah verify_complete dan key BARU SAJA dibuat,
//    auto-finalize mapping ke discord_free_keys.
//    Bridge ini "menumpang" di belakang layar, tanpa ganggu flow asli. ──
if (($_GET['status'] ?? '') === 'verify_complete' && !empty($bridge_token)) {
    // Daftarkan shutdown hook: setelah get-key.php selesai generate key,
    // kita cek apakah key baru saja dibuat untuk token ini, lalu finalize.
    register_shutdown_function(function () use ($pdo, $bridge_token) {
        // Ambil key_code yang baru dibuat lewat token ini.
        // Karena keys_system tidak menyimpan token langsung, kita pakai
        // pendekatan: ambil token punya IP siapa, lalu cocokkan key terbaru milik IP itu.
        $stmt = $pdo->prepare("SELECT ip FROM verify_tokens WHERE token = ? LIMIT 1");
        $stmt->execute([$bridge_token]);
        $tok = $stmt->fetch();
        if (!$tok) return;

        $stmt2 = $pdo->prepare("
            SELECT key_code, expiry_date FROM keys_system
            WHERE last_ip = ? AND type = 'free'
            ORDER BY id DESC LIMIT 1
        ");
        $stmt2->execute([$tok['ip']]);
        $keyrow = $stmt2->fetch();

        if ($keyrow) {
            discord_bridge_finalize($pdo, $bridge_token, $keyrow['key_code'], $keyrow['expiry_date']);
        }
    });
}
