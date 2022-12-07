import TelegramApi from 'node-telegram-bot-api';
import { config } from 'dotenv';

config();

const token = process.env.API_TOKEN;
const bot = new TelegramApi(token, { polling: true });

const BotCommands = {
    START: '/start',
    ADD_NOTE: '/add_note',
    GET_NOTES: '/get_notes',
    DELETE_NOTES: '/delete_notes',
    EDIT_NOTES: '/edit_notes',
}

const { START, ADD_NOTE, GET_NOTES, DELETE_NOTES, EDIT_NOTES } = BotCommands;

let flagAddNote = false;
let flagStartEditNote = false;
let flagEndEditNote = false;
let changedNoteId = 0;

const resetAddNote = () => {
    if (flagAddNote) flagAddNote = false;
};

const resetStartEditNote = () => {
    if (flagStartEditNote) flagStartEditNote = false;
}

const resetEndEditNote = () => {
    if (flagEndEditNote) flagEndEditNote = false;
}

const resetAllFlags = () => {
    resetAddNote();
    resetStartEditNote();
    resetEndEditNote();
}

let userNotes = [];
const yesDeleteNotesCallback = 'yes_delete_notes_callback';
const noDeleteNotesCallback = 'no_delete_notes_callback';

const start = async () => {
    await bot.setMyCommands([
        { command: START, description: 'Start diary' },
        { command: ADD_NOTE, description: 'Add note' },
        { command: GET_NOTES, description: 'Get notes' },
        { command: DELETE_NOTES, description: 'Delete notes' },
        { command: EDIT_NOTES, description: 'Edit notes' },
    ]);

    bot.on('message', async msg => {
        const text = msg?.text;
        const chatId = msg?.chat?.id;
        const userName = msg?.from?.first_name;

        if (text === START) {
            resetAllFlags();

            await bot.sendMessage(chatId, `Welcome to Diary notes, ${userName}`);
            return bot.sendMessage(chatId, `Get started with ${ADD_NOTE}`);
        }

        if (text === ADD_NOTE) {
            resetAllFlags();
            flagAddNote = true;

            return bot.sendMessage(chatId, `Write note`);
        }

        if (text === GET_NOTES) {
            resetAllFlags();

            if (!userNotes.length) {
                return bot.sendMessage(chatId, `Notes not found, ${ADD_NOTE}`);
            }
            await bot.sendMessage(chatId, `My notes: ${userNotes.map(({ id, text }) => `\n${id}) ${text}`)}`);

            return bot.sendMessage(chatId, `${ADD_NOTE}\n${EDIT_NOTES}\n${DELETE_NOTES}`);
        }

        if (text === DELETE_NOTES) {
            resetAllFlags();

            if (!userNotes.length) {
                return bot.sendMessage(chatId, `Notes not found, ${ADD_NOTE}`);
            }

            await bot.sendMessage(chatId, `My notes: ${userNotes.map(({ id, text }) => `\n${id}) ${text}`)}`);

            return bot.sendMessage(chatId, `Are you sure to delete all the notes?`, {
                reply_markup: JSON.stringify({
                    inline_keyboard: [
                        [
                            { text: 'Yes', callback_data: yesDeleteNotesCallback },
                            { text: 'No', callback_data: noDeleteNotesCallback }
                        ],
                    ]
                })
            });
        }

        if (text === EDIT_NOTES) {
            resetAllFlags();
            flagStartEditNote = true;

            if (!userNotes.length) {
                return bot.sendMessage(chatId, `Notes not found, ${ADD_NOTE}`);
            }

            await bot.sendMessage(chatId, `My notes: ${userNotes.map(({ id, text }) => `\n${id}) ${text}`)}`);

            return bot.sendMessage(chatId, `Write the item number of notes you want to edit`);
        }

        if (flagAddNote) {
            if (!userNotes.length) {
                userNotes.push({ id: 1, text, date: Date.now() });
            } else {
                userNotes.push({ id: userNotes.length + 1, text, date: Date.now() });
            }
            await bot.sendMessage(chatId, `Successfully added!`);
            return bot.sendMessage(chatId, `Continue typing or ${GET_NOTES}, ${EDIT_NOTES}, ${DELETE_NOTES}`);
        }

        if (flagStartEditNote) {
            const id = Number(text);
            const note = userNotes.find(item => item.id === id);

            if (note) {
                resetAllFlags();
                flagEndEditNote = true;
                changedNoteId = id;

                await bot.sendMessage(chatId, `Let's edit note № ${id}:\n${note.text}`);
                return bot.sendMessage(chatId, `Send changed note below`);
            } else {
                return bot.sendMessage(chatId, `Item number is incorrect or not found. Try again`);
            }
        }

        if (flagEndEditNote) {
            resetAllFlags();
            userNotes[changedNoteId - 1].text = text;
            changedNoteId = 0;

            await bot.sendMessage(chatId, `Successfully changed!`);
            await bot.sendMessage(chatId, `My notes: ${userNotes.map(({ id, text }) => `\n${id}) ${text}`)}`);
            return bot.sendMessage(chatId, `${ADD_NOTE}\n${EDIT_NOTES}\n${DELETE_NOTES}`);
        }

        return bot.sendMessage(chatId, `Start with ${ADD_NOTE}`);
    });

    bot.on('callback_query', async msg => {
        const data = msg?.data;
        const chatId = msg?.message?.chat.id;

        if (data.includes(yesDeleteNotesCallback)) {
            userNotes = [];
            return bot.sendMessage(chatId, `Successfully deleted all notes`);
        }

        if (data.includes(noDeleteNotesCallback)) {
            await bot.sendMessage(chatId, `OK`);
            return bot.sendMessage(chatId, `${ADD_NOTE}\n${EDIT_NOTES}\n${GET_NOTES}\n${DELETE_NOTES}`);
        }
    });
}

start();