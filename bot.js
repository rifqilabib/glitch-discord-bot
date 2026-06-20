// ============================================================
// bot.js — GlitchRoblox Discord Free Key Bot
// Bot benar-benar membuka shortlink pakai Puppeteer (headless Chrome)
// supaya MASUK STATISTIK move2link, seperti manusia buka browser.
//
// WAJIB ada file nixpacks.toml di root project (sudah disediakan)
// supaya Railway install Chromium dengan benar.
//
// Install: npm install discord.js puppeteer-core axios
// ============================================================

const {
    Client, GatewayIntentBits, SlashCommandBuilder,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder,
    ButtonStyle, REST, Routes
} = require('discord.js');
const axios = require('axios');
const puppeteer = require('puppeteer-core');

// ============================================================
// KONFIGURASI — semua dari Railway Variables
// ============================================================
const CONFIG = {
    BOT_TOKEN:    process.env.BOT_TOKEN,
    CLIENT_ID:    process.env.CLIENT_ID,
    PANEL_URL:    process.env.PANEL_URL    || 'https://glitchmods.com/GlitchRoblox',
    API_SECRET:   process.env.API_SECRET,
    CHANNEL_ID:   process.env.CHANNEL_ID   || '',
    LINK_SERVER:  process.env.LINK_SERVER  || 'https://discord.gg/INVITE_KAMU',
    LINK_WEBSITE: process.env.LINK_WEBSITE || 'https://glitchmods.com',

    // Path Chromium hasil install nixpacks (Railway/Nix)
    CHROME_PATH:  process.env.CHROME_PATH  || '/nix/store/.chromium-wrapped/bin/chromium',

    SHORTLINK_WAIT_MS: 9000, // tunggu 9 detik di halaman shortlink (durasi timer iklan)
};
// ============================================================

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const sleep  = (ms) => new Promise(r => setTimeout(r, ms));

// ── Cari executable Chromium otomatis (Railway/Nix kadang beda path) ──
const { execSync } = require('child_process');
function findChromiumPath() {
    if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
    try {
        const result = execSync('which chromium || which chromium-browser || which google-chrome').toString().trim();
        if (result) return result;
    } catch {}
    return CONFIG.CHROME_PATH; // fallback
}

// ── Register slash command ───────────────────────────────────
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('getkey')
            .setDescription('🔑 Get your free Glitch Team key')
            .toJSON()
    ];
    const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commands });
        console.log('[✓] Slash command /getkey terdaftar');
    } catch (e) {
        console.error('[!] Gagal register:', e.message);
    }
}

// ── Ambil config dari panel ──────────────────────────────────
async function getPanelConfig() {
    try {
        const res = await axios.get(`${CONFIG.PANEL_URL}/api/discord_key.php`, {
            params: { action: 'get_config' },
            headers: { 'X-Bot-Secret': CONFIG.API_SECRET },
            timeout: 8000
        });
        return res.data;
    } catch { return null; }
}

// ── Generate key dari panel ──────────────────────────────────
async function generateKey(discordId) {
    const res = await axios.get(`${CONFIG.PANEL_URL}/api/discord_key.php`, {
        params: { action: 'generate', discord_id: discordId },
        headers: { 'X-Bot-Secret': CONFIG.API_SECRET },
        timeout: 10000
    });
    return res.data;
}

// ── Build URL shortlink sesuai provider ─────────────────────
function buildShortlinkUrl(type, baseUrl, apiKey, destination) {
    const enc = encodeURIComponent(destination);
    switch (type) {
        case 'lootlinks': case 'workink':
            return `${baseUrl}?api=${encodeURIComponent(apiKey)}&url=${enc}`;
        case 'lootlabs': case 'rekonise':
            return `${baseUrl}?token=${encodeURIComponent(apiKey)}&url=${enc}`;
        case 'linkvertise':
            return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(apiKey)}?link=${enc}`;
        default: // move2link
            return `${baseUrl}?key=${encodeURIComponent(apiKey)}&destination_url=${enc}&should_redirect=true`;
    }
}

// ================================================================
// INTI: Bot buka shortlink pakai Puppeteer (headless Chromium)
// — Render JS, jalankan timer iklan, gerakkan mouse, scroll,
//   klik tombol continue — supaya tercatat di statistik move2link
// ================================================================
let cachedChromePath = null;

async function visitShortlinkLikeHuman(shortlinkUrl, stepLabel, onProgress) {
    let browser = null;
    try {
        if (!cachedChromePath) cachedChromePath = findChromiumPath();

        onProgress(`🌐 Membuka browser untuk checkpoint ${stepLabel}...`);

        browser = await puppeteer.launch({
            headless: true,
            executablePath: cachedChromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1366,768',
            ],
        });

        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        );

        // Sembunyikan tanda automation
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        });

        await page.setViewport({ width: 1366, height: 768 });
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8' });

        onProgress(`📄 Loading halaman shortlink ${stepLabel}...`);

        await page.goto(shortlinkUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await sleep(2000);

        // Simulasi gerakan manusia: mouse move + scroll random
        try {
            await page.mouse.move(200, 300);
            await sleep(400);
            await page.mouse.move(600, 150, { steps: 10 });
            await page.evaluate(() => window.scrollBy(0, 200));
            await sleep(600);
            await page.evaluate(() => window.scrollBy(0, -100));
        } catch {}

        onProgress(`⏳ Menunggu timer iklan checkpoint ${stepLabel}...`);

        // Tunggu durasi penuh timer shortlink supaya View tercatat valid
        await sleep(CONFIG.SHORTLINK_WAIT_MS);

        // Klik tombol Continue/Get Link/Claim sesuai provider
        const continueSelectors = [
            'a[id*="continue"]', 'button[id*="continue"]',
            'a.btn-continue', 'button.btn-continue',
            '#continue-btn', '.continue-btn',
            '#get-link', '.get-link', 'a#get-link',
            '#claim-button', '.claim-button',
            '#proceed', '.proceed',
            '#ad-continue', '.ad-continue',
            'a[href*="destination"]', 'a[href*="redirect"]',
            'button[class*="btn"]', 'a[class*="btn"]',
        ];

        let clicked = false;
        for (const selector of continueSelectors) {
            try {
                const el = await page.$(selector);
                if (el) {
                    const isVisible = await el.isIntersectingViewport();
                    if (isVisible) {
                        await page.mouse.move(300, 400, { steps: 8 });
                        await sleep(300);
                        await el.click();
                        clicked = true;
                        console.log(`[✓] Klik tombol: ${selector}`);
                        break;
                    }
                }
            } catch {}
        }

        if (!clicked) {
            console.log('[~] Tombol tidak ditemukan, tunggu redirect otomatis...');
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await sleep(3000);
        }

        await sleep(2500);

        const finalUrl = page.url();
        console.log(`[✓] Shortlink ${stepLabel} selesai → ${finalUrl}`);

        onProgress(`✅ Checkpoint ${stepLabel} berhasil!`);
        return true;

    } catch (err) {
        console.error(`[!] Shortlink ${stepLabel} error:`, err.message);
        onProgress(`⚠️ Checkpoint ${stepLabel} timeout, lanjut...`);
        return false;
    } finally {
        if (browser) await browser.close();
    }
}

// ── Tombol-tombol bawah embed ────────────────────────────────
function buildButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_result')
            .setLabel('Result')
            .setEmoji('📋')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true),
        new ButtonBuilder()
            .setLabel('Server')
            .setEmoji('🌐')
            .setStyle(ButtonStyle.Link)
            .setURL(CONFIG.LINK_SERVER),
        new ButtonBuilder()
            .setLabel('Website')
            .setEmoji('🖥️')
            .setStyle(ButtonStyle.Link)
            .setURL(CONFIG.LINK_WEBSITE),
    );
}

function embedLoading(statusLine, detail = '') {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setDescription(`**⏳ Processing...**\n\`\`\`\n${statusLine}${detail ? '\n' + detail : ''}\n\`\`\``)
        .setFooter({ text: 'Glitch Team Key System' });
}

function embedSuccess(key, requestedBy, elapsedSec) {
    return new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(
            `**✅ Key Retrieved!**\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Your key has been retrieved. Copy it and input it into the application.\n` +
            `\`${key}\`\n\n` +
            `\`\`\`\n${key}\n\`\`\``
        )
        .setFooter({ text: `Requested by ${requestedBy}. • ⏱️ ${elapsedSec}s` });
}

function embedError(msg) {
    return new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription(`**❌ Failed**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\`\`\`\n${msg}\n\`\`\``)
        .setFooter({ text: 'Glitch Team Key System' });
}

// ── HANDLER /getkey ──────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'getkey') return;

    if (CONFIG.CHANNEL_ID && interaction.channelId !== CONFIG.CHANNEL_ID) {
        return interaction.reply({ content: `❌ Hanya di <#${CONFIG.CHANNEL_ID}>`, ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const userId    = interaction.user.id;
    const username  = interaction.user.username;
    const startTime = Date.now();

    const setLoading = async (status, detail = '') => {
        await interaction.editReply({
            embeds: [embedLoading(status, detail)],
            components: [buildButtons()]
        }).catch(() => {});
    };

    try {
        await setLoading('Syncing with panel...', 'Checking config & maintenance');
        const config = await getPanelConfig();

        if (!config?.ok)          return interaction.editReply({ embeds: [embedError('Cannot connect to panel.')], components: [buildButtons()] });
        if (config.maintenance)   return interaction.editReply({ embeds: [embedError('Server is under maintenance.')], components: [buildButtons()] });
        if (!config.free_enabled) return interaction.editReply({ embeds: [embedError('Free key is currently disabled.')], components: [buildButtons()] });

        const totalLinks = config.shortlink_count || 1;

        for (let i = 0; i < totalLinks; i++) {
            const stepLabel = `${i + 1}/${totalLinks}`;
            const dest  = `${CONFIG.PANEL_URL}/get_key-free/get-key.php?status=verify_complete&discord=1`;
            const slUrl = buildShortlinkUrl(config.shortlink_type, config.shortlink_url, config.shortlink_api, dest);

            await visitShortlinkLikeHuman(slUrl, stepLabel, async (msg) => {
                await setLoading(msg, `Checkpoint ${i + 1} dari ${totalLinks}`);
            });

            if (i < totalLinks - 1) await sleep(1000);
        }

        await setLoading('Generating your key...', 'Almost done');
        await sleep(500);

        const result = await generateKey(userId);

        if (!result?.ok) {
            return interaction.editReply({
                embeds: [embedError(result?.msg || 'Key generation failed.')],
                components: [buildButtons()]
            });
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        await interaction.editReply({
            embeds: [embedSuccess(result.key, username, elapsed)],
            components: [buildButtons()]
        });

        console.log(`[KEY] ${username} (${userId}) → ${result.key} | ${elapsed}s`);

    } catch (err) {
        console.error('[ERROR]', err.message);
        await interaction.editReply({
            embeds: [embedError('Internal error. Contact owner.')],
            components: [buildButtons()]
        }).catch(() => {});
    }
});

// ── Bot ready ────────────────────────────────────────────────
client.once('ready', async () => {
    console.log(`[✓] Logged in as ${client.user.tag}`);
    client.user.setActivity('/getkey — Free Glitch Key', { type: 0 });
    await registerCommands();
    console.log('[✓] Bot siap! Chrome path:', cachedChromePath || '(belum dicek)');
});

client.login(CONFIG.BOT_TOKEN);
