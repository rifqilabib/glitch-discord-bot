// ============================================================
// bot.js — GlitchRoblox Discord Free Key Bot
// Versi Railway — pakai process.env untuk semua config
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
    PANEL_URL:    process.env.PANEL_URL    || 'https://glitchmods.com',
    API_SECRET:   process.env.API_SECRET,
    CHANNEL_ID:   process.env.CHANNEL_ID  || '',
    LINK_SERVER:  process.env.LINK_SERVER  || 'https://discord.gg/INVITE_KAMU',
    LINK_WEBSITE: process.env.LINK_WEBSITE || 'https://glitchmods.com',
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const sleep  = (ms) => new Promise(r => setTimeout(r, ms));

async function registerCommands() {
    const commands = [
        new SlashCommandBuilder()
            .setName('getkey')
            .setDescription('Get your free Glitch Team key')
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

async function generateKey(discordId) {
    const res = await axios.get(`${CONFIG.PANEL_URL}/api/discord_key.php`, {
        params: { action: 'generate', discord_id: discordId },
        headers: { 'X-Bot-Secret': CONFIG.API_SECRET },
        timeout: 10000
    });
    return res.data;
}

async function visitShortlink(url, label) {
    try {
        await axios.get(url, {
            maxRedirects: 10,
            timeout: 15000,
            validateStatus: (s) => s < 500,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
                'Referer': 'https://discord.com/',
            },
        });
        console.log(`[✓] Shortlink ${label} visited`);
    } catch (e) {
        console.log(`[~] Shortlink ${label}: ${e.message}`);
    }
}

function buildShortlinkUrl(type, baseUrl, apiKey, destination) {
    const enc = encodeURIComponent(destination);
    switch (type) {
        case 'lootlinks': case 'workink':
            return `${baseUrl}?api=${encodeURIComponent(apiKey)}&url=${enc}`;
        case 'lootlabs': case 'rekonise':
            return `${baseUrl}?token=${encodeURIComponent(apiKey)}&url=${enc}`;
        case 'linkvertise':
            return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(apiKey)}?link=${enc}`;
        default:
            return `${baseUrl}?key=${encodeURIComponent(apiKey)}&destination_url=${enc}&should_redirect=true`;
    }
}

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

function embedLoading(status, detail = '') {
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setDescription(`**⏳ Processing...**\n\`\`\`\n${status}${detail ? '\n' + detail : ''}\n\`\`\``)
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
            await setLoading(`Bypassing checkpoint ${i + 1}/${totalLinks}...`, 'Please wait');
            const dest  = `${CONFIG.PANEL_URL}/get_key-free/get-key.php?status=verify_complete&discord=1`;
            const slUrl = buildShortlinkUrl(config.shortlink_type, config.shortlink_url, config.shortlink_api, dest);
            await visitShortlink(slUrl, `${i + 1}/${totalLinks}`);
            if (i < totalLinks - 1) await sleep(1500);
        }

        await setLoading('Generating your key...', 'Almost done');
        await sleep(500);

        const result = await generateKey(userId);

        if (!result?.ok) {
            return interaction.editReply({ embeds: [embedError(result?.msg || 'Key generation failed.')], components: [buildButtons()] });
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

client.once('ready', async () => {
    console.log(`[✓] Logged in as ${client.user.tag}`);
    client.user.setActivity('/getkey — Free Glitch Key', { type: 0 });
    await registerCommands();
    console.log('[✓] Bot siap!');
});

client.login(CONFIG.BOT_TOKEN);
