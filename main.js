import { loadTokensFromFile } from './utils/file.js';
import { getUserInfo, verifyQuest, getSocialQuests, claimDailyReward, buyFishing, useItem, completeTutorial } from './utils/api.js';
import { banner } from './utils/banner.js';
import { logger } from './utils/logger.js';
import { fishing } from './utils/game.js';
import readline from 'readline';

const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
    }));
};

async function processToken(token, type, counter) {
    try {
        const profile = await getUserInfo(token);

        if (!profile) {
            logger(`Failed to fetch profile for Account #${counter}:`, 'error');
            return;
        }

        const isCompleteTutorial = profile.isCompleteTutorial;
        const isClaimedDailyReward = profile.isClaimedDailyReward;
        const userId = profile.id;
        logger(`Account #${counter} | EXP Points: ${profile.fishPoint} | Gold: ${profile.gold} | Energy: ${profile.energy} | Banned: ${profile.isBanned}`, 'debug');

        if (!isCompleteTutorial) {
            await completeTutorial(token, userId);
            const quests = await getSocialQuests(token);
            const ids = quests.map(item => item.id);
            for (const id of ids) {
                logger(`Account #${counter} | Claim Quests ID:`, 'info', id);
                await verifyQuest(token, userId);
            }
        } else if (!isClaimedDailyReward) {
            await claimDailyReward(token);
        } else if (profile.gold > 1500) {
            const buy = await buyFishing(token, userId);
            if (buy) {
                logger(`Account #${counter} | Buy and Use Exp Scroll for user ${userId}`);
                await useItem(token, userId);
            }
        }

        if (type === '1' && profile.energy > 0) {
            await fishing(token, type);
        } else if (type === '2' && profile.energy > 1) {
            await fishing(token, type);
        } else if (type === '3' && profile.energy > 2) {
            await fishing(token, type);
        } else {
            logger(`Account #${counter} | Not Enough Energy to start fishing...`, 'warn');
        }

    } catch (error) {
        logger(`Error processing Account #${counter}: ${error.message}`, 'error');
    }
}

async function main() {
    logger(banner, 'debug');
    const tokens = loadTokensFromFile('tokens.txt');
    const limit = parseInt(await askQuestion('Enter the concurrency limit: '), 20);
    let type = await askQuestion('Choose Your fishing type\n1. short_range\n2. mid_range\n3. long_range\nEnter your choice (1, 2, 3): ');

    const concurrencyQueue = [];
    let activePromises = 0;

    while (true) {
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (activePromises < limit) {
                activePromises++;
                const promise = processToken(token, type, i + 1).finally(() => activePromises--);
                concurrencyQueue.push(promise);
            } else {
                await Promise.race(concurrencyQueue);
            }
        }

        // Tunggu semua tugas selesai sebelum iterasi berikutnya
        await Promise.all(concurrencyQueue);
        concurrencyQueue.length = 0; // Kosongkan antrean

        logger('Waiting before starting next fishing cycle...');
        await new Promise(resolve => setTimeout(resolve, 21600 * 1000));
    }
}

main().catch(error => {
    logger('Error in main loop:', 'error');
});
