// ============================================================
// bot.js — GlitchRoblox Discord Free Key Bot (Link-Based)
// User klik link sendiri di browser mereka → masuk statistik move2link asli
// Install: npm install discord.js axios
// ============================================================

const {
    Client, GatewayIntentBits, SlashCommandBuilder,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder,
    ButtonStyle, REST, Routes
} = require('discord.js');
const axios = require('axios');

const CONFIG = {
    BOT_TOKEN:    process.env.BOT_TOKEN,
    CLIENT_ID:    process.env.CLIENT_ID,
    PANEL_URL:    process.env.PANEL_URL    || 'https://glitchmods.com/GlitchRoblox',
    API_SECRET:   process.env.API_SECRET,
    CHANNEL_ID:   process.env.CHANNEL_ID   || '',
    LINK_SERVER:  process.env.LINK_SERVER  || 'https://discord.gg/INVITE_KAMU',
    LINK_WEBSITE: process.env.LINK_WEBSITE || 'https://glitchmods.com',
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ── Register slash commands ──────────────────────────────────
async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('getkey')
            .setDescription('🔑 Dapatkan link verifikasi, atau ambil key kalau sudah selesai verifikasi')
            .toJSON(),
    ];
    const rest = new REST({ version: '10' }).setToken(CONFIG.BOT_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CONFIG.CLIENT_ID), { body: commands });
        console.log('[✓] Slash command /getkey terdaftar');
    } catch (e) {
        console.error('[!] Gagal register:', e.message);
    }
}

async function getPanelConfig() {
    try {
        const res = await axios.get(`${CONFIG.PANEL_URL}/api/discord_api.php`, {
            params: { action: 'get_config' },
            headers: { 'X-Bot-Secret': CONFIG.API_SECRET },
            timeout: 8000
        });
        return res.data;
    } catch { return null; }
}

async function createLink(discordId) {
    const res = await axios.get(`${CONFIG.PANEL_URL}/api/discord_api.php`, {
        params: { action: 'create_link', discord_id: discordId },
        headers: { 'X-Bot-Secret': CONFIG.API_SECRET },
        timeout: 10000
    });
    return res.data;
}

async function checkStatus(discordId) {
    const res = await axios.get(`${CONFIG.PANEL_URL}/api/discord_api.php`, {
        params: { action: 'check_status', discord_id: discordId },
        headers: { 'X-Bot-Secret': CONFIG.API_SECRET },
        timeout: 10000
    });
    return res.data;
}

function buildButtons(verifyUrl = null) {
    const row = new ActionRowBuilder();
    if (verifyUrl) {
        row.addComponents(
            new ButtonBuilder()
                .setLabel('🔗 Klik untuk Verifikasi')
                .setStyle(ButtonStyle.Link)
                .setURL(verifyUrl)
        );
    }
    row.addComponents(
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
    return row;
}

function embedGetLink(verifyUrl) {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🔑 Free Key Verification')
        .setDescription(
            `Klik tombol **🔗 Klik untuk Verifikasi** di bawah untuk memulai.\n\n` +
            `**Langkah-langkah:**\n` +
            `1️⃣ Klik tombol verifikasi (atau salin link-nya)\n` +
            `2️⃣ Lewati halaman iklan yang muncul\n` +
            `3️⃣ Tunggu sampai redirect selesai & key muncul di web\n` +
            `4️⃣ Balik ke Discord, ketik \`/getkey\` lagi untuk ambil key kamu\n\n` +
            `⚠️ Link ini personal untuk kamu — jangan dibagikan ke orang lain.`
        )
        .setFooter({ text: 'Glitch Team Key System' });
}

function embedAlreadyHasKey(key, expiresUnix) {
    return new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(
            `**✅ Key Retrieved!**\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Kamu sudah punya key aktif:\n` +
            `\`${key}\`\n\n` +
            `\`\`\`\n${key}\n\`\`\`\n` +
            `Expires: <t:${expiresUnix}:R>`
        )
        .setFooter({ text: 'Glitch Team Key System' });
}

function embedClaimSuccess(key, requestedBy, expiresUnix) {
    return new EmbedBuilder()
        .setColor(0x57F287)
        .setDescription(
            `**✅ Key Retrieved!**\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Verifikasi berhasil! Ini key kamu:\n` +
            `\`${key}\`\n\n` +
            `\`\`\`\n${key}\n\`\`\`\n` +
            `Expires: <t:${expiresUnix}:R>`
        )
        .setFooter({ text: `Requested by ${requestedBy}` });
}

function embedError(msg) {
    return new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription(`**❌ Failed**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\`\`\`\n${msg}\n\`\`\``)
        .setFooter({ text: 'Glitch Team Key System' });
}

function toUnix(mysqlDatetime) {
    // mysqlDatetime format: "YYYY-MM-DD HH:MM:SS" (asumsi timezone server panel = Asia/Jakarta)
    const d = new Date(mysqlDatetime.replace(' ', 'T') + '+07:00');
    return Math.floor(d.getTime() / 1000);
}

// ── HANDLER /getkey ──────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (CONFIG.CHANNEL_ID && interaction.channelId !== CONFIG.CHANNEL_ID) {
        return interaction.reply({ content: `❌ Hanya di <#${CONFIG.CHANNEL_ID}>`, ephemeral: true });
    }

    const userId   = interaction.user.id;
    const username = interaction.user.username;

    // ── /getkey ──
    if (interaction.commandName === 'getkey') {
        await interaction.deferReply({ ephemeral: true });

        try {
            const config = await getPanelConfig();
            if (!config?.ok)          return interaction.editReply({ embeds: [embedError('Cannot connect to panel.')] });
            if (config.maintenance)   return interaction.editReply({ embeds: [embedError('Server is under maintenance.')] });
            if (!config.free_enabled) return interaction.editReply({ embeds: [embedError('Free key is currently disabled.')] });

            // Cek dulu: mungkin user sudah selesai verifikasi dari link sebelumnya
            const status = await checkStatus(userId);
            if (status?.ok && status.verified) {
                const expiresUnix = toUnix(status.expires_at);
                await interaction.editReply({
                    embeds: [embedClaimSuccess(status.key, username, expiresUnix)],
                    components: [buildButtons()]
                });
                console.log(`[CLAIM] ${username} (${userId}) → ${status.key}`);
                return;
            }

            // Belum verifikasi -> buat / ambil link verifikasi
            const result = await createLink(userId);
            if (!result?.ok) {
                return interaction.editReply({ embeds: [embedError(result?.msg || 'Failed to create link.')] });
            }

            if (result.has_key) {
                const expiresUnix = toUnix(result.expires_at);
                return interaction.editReply({
                    embeds: [embedAlreadyHasKey(result.key, expiresUnix)],
                    components: [buildButtons()]
                });
            }

            return interaction.editReply({
                embeds: [embedGetLink(result.verify_url)],
                components: [buildButtons(result.verify_url)]
            });

        } catch (err) {
            console.error('[ERROR /getkey]', err.message);
            await interaction.editReply({ embeds: [embedError('Internal error.')] }).catch(() => {});
        }
    }
});

client.once('ready', async () => {
    console.log(`[✓] Logged in as ${client.user.tag}`);
    client.user.setActivity('/getkey — Free Glitch Key', { type: 0 });
    await registerCommands();
    console.log('[✓] Bot siap!');
});

client.login(CONFIG.BOT_TOKEN);
