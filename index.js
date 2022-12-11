import TelegramApi from 'node-telegram-bot-api';
import { config } from 'dotenv';
import sequelize from './db.js';
import UserModel from './models.js';

config();

const token = process.env.API_TOKEN;
const bot = new TelegramApi(token, { polling: true });

const BotCommands = {
    START: '/start',
    ADD_NOTE: '/add_note',
    EDIT_NOTE: '/edit_note',
    GET_NOTES: '/get_notes',
    DELETE_NOTE: '/delete_note',
    DELETE_NOTES: '/delete_notes',
    CANCEL: '/cancel',
}

const { START, ADD_NOTE, GET_NOTES, DELETE_NOTE, DELETE_NOTES, EDIT_NOTE, CANCEL } = BotCommands;

let diaryState = {
    addNote: false,
    startEditNote: false,
    endEditNote: false,
    deleteNote: false,
};

let changedNoteId = 0;

const resetDiaryState = () => {
    for (const key in diaryState) diaryState[key] = false;
}

const setDiaryState = (key, value) => {
    diaryState = { ...diaryState, [key]: value };
}

const yesDeleteNotesCallback = 'yes_delete_notes_callback';
const noDeleteNotesCallback = 'no_delete_notes_callback';

const start = async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync();
    } catch (e) {
        console.error(`Something went wrong with db connection`, e);
    }

    await bot.setMyCommands([
        { command: START, description: 'Start diary' },
        { command: ADD_NOTE, description: 'Add note' },
        { command: EDIT_NOTE, description: 'Edit note' },
        { command: GET_NOTES, description: 'Get notes' },
        { command: DELETE_NOTE, description: 'Delete note' },
        { command: DELETE_NOTES, description: 'Delete notes' },
    ]);

    bot.on('message', async msg => {
        const text = msg?.text;
        const chatId = msg?.chat?.id;
        const userName = msg?.from?.first_name;

        try {
            let user = await UserModel.findOne({ chatId });
            if (!user) await UserModel.create({ chatId });

            user = await UserModel.findOne({ chatId });
            const userNotes = user.notes ? user.notes.split(',') : [];

            if (text === START) {
                resetDiaryState();

                await bot.sendMessage(chatId, `Welcome to diary notes, ${userName}`);
                return bot.sendMessage(chatId, `Get started with ${ADD_NOTE}`);
            }

            if (text === ADD_NOTE) {
                resetDiaryState();
                setDiaryState('addNote', true);

                return bot.sendMessage(chatId, `Write a new note, ${CANCEL}`);
            }

            if (text === GET_NOTES) {
                resetDiaryState();

                if (!userNotes.length) {
                    return bot.sendMessage(chatId, `Notes are not found, ${ADD_NOTE}`);
                }
                await bot.sendMessage(chatId, `Diary notes: ${userNotes.map((note, index) => `\n${index + 1}) ${note}`)}`);
                return bot.sendMessage(chatId, `${ADD_NOTE}\n${EDIT_NOTE}\n${DELETE_NOTE}\n${DELETE_NOTES}`);
            }

            if (text === DELETE_NOTE) {
                resetDiaryState();

                if (!userNotes.length) {
                    return bot.sendMessage(chatId, `Notes are not found, ${ADD_NOTE}`);
                }

                setDiaryState('deleteNote', true);

                await bot.sendMessage(chatId, `Diary notes: ${userNotes.map((note, index) => `\n${index + 1}) ${note}`)}`);
                return bot.sendMessage(chatId, `Write the number of note you want to delete, ${CANCEL}`);
            }

            if (text === DELETE_NOTES) {
                resetDiaryState();

                if (!userNotes.length) {
                    return bot.sendMessage(chatId, `Notes are not found, ${ADD_NOTE}`);
                }

                await bot.sendMessage(chatId, `Diary notes: ${userNotes.map((note, index) => `\n${index + 1}) ${note}`)}`);
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

            if (text === EDIT_NOTE) {
                resetDiaryState();

                if (!userNotes.length) {
                    return bot.sendMessage(chatId, `Notes are not found, ${ADD_NOTE}`);
                }

                setDiaryState('startEditNote', true);

                await bot.sendMessage(chatId, `Diary notes: ${userNotes.map((note, index) => `\n${index + 1}) ${note}`)}`);
                return bot.sendMessage(chatId, `Write the number of note you want to edit, ${CANCEL}`);
            }

            if (text === CANCEL) {
                resetDiaryState();
                await bot.sendMessage(chatId, `Ok. You can choose another command:`);
                return bot.sendMessage(chatId, `${GET_NOTES}\n${ADD_NOTE}\n${EDIT_NOTE}\n${DELETE_NOTE}\n${DELETE_NOTES}`);
            }

            if (diaryState.addNote) {
                if (!userNotes.length) {
                    user.notes = text;
                } else {
                    user.notes += `,${text}`;
                }

                await user.save();
                await bot.sendMessage(chatId, `Successfully added!`);
                await bot.sendMessage(chatId, `Continue typing, ${CANCEL}`);
                return bot.sendMessage(chatId, `${GET_NOTES}, ${EDIT_NOTE}, ${DELETE_NOTE}, ${DELETE_NOTES}`);
            }

            if (diaryState.startEditNote) {
                const id = Number(text);
                const note = userNotes[id - 1];

                if (note) {
                    resetDiaryState();
                    setDiaryState('endEditNote', true);
                    changedNoteId = id;

                    await bot.sendMessage(chatId, `Let's edit note № ${id}:`);
                    await bot.sendMessage(chatId, `"${note}"`);
                    return bot.sendMessage(chatId, `Write changed note, ${CANCEL}`);
                }

                return bot.sendMessage(chatId, `Given number is incorrect or not found. Try again, ${CANCEL}`);
            }

            if (diaryState.endEditNote) {
                resetDiaryState();
                userNotes[changedNoteId - 1] = text;
                user.notes = userNotes.join(',');
                changedNoteId = 0;

                await user.save();
                await bot.sendMessage(chatId, `Successfully changed!`);
                await bot.sendMessage(chatId, `Diary notes: ${userNotes.map((note, index) => `\n${index + 1}) ${note}`)}`);
                return bot.sendMessage(chatId, `${ADD_NOTE}\n${EDIT_NOTE}\n${DELETE_NOTE}\n${DELETE_NOTES}`);
            }

            if (diaryState.deleteNote) {
                const id = Number(text);
                const note = userNotes[id - 1];

                if (note) {
                    resetDiaryState();

                    if (userNotes.length === 1) {
                        user.notes = '';
                        await user.save();
                        await bot.sendMessage(chatId, `Successfully deleted the note`);
                        return bot.sendMessage(chatId, `${ADD_NOTE}`);
                    }
                    const searchValue = id === 1 ? `${note},` : `,${note}`;
                    user.notes = user.notes.replace(searchValue, '');

                    await user.save();
                    await bot.sendMessage(chatId, `Successfully deleted the note`);
                    await bot.sendMessage(chatId, `Diary notes: ${user.notes.split(',').map((note, index) => `\n${index + 1}) ${note}`)}`);
                    return bot.sendMessage(chatId, `${ADD_NOTE}\n${EDIT_NOTE}\n${DELETE_NOTE}\n${DELETE_NOTES}`);
                }

                return bot.sendMessage(chatId, `Given number is incorrect or not found. Try again, ${CANCEL}`);
            }

            return bot.sendMessage(chatId, `Get started with ${ADD_NOTE}`);

        } catch (e) {
            return bot.sendMessage(chatId, 'Oops... Something went wrong. Restart the bot please');
        }
    });

    bot.on('callback_query', async msg => {
        const data = msg?.data;
        const chatId = msg?.message?.chat?.id;
        const user = await UserModel.findOne({ chatId });

        if (data.includes(yesDeleteNotesCallback)) {
            user.notes = '';
            await user.save();
            await bot.sendMessage(chatId, `Successfully deleted all notes`);
            return bot.sendMessage(chatId, `${ADD_NOTE}`);
        }

        if (data.includes(noDeleteNotesCallback)) {
            await bot.sendMessage(chatId, `Ok. You can choose another command:`);
            return bot.sendMessage(chatId, `${ADD_NOTE}\n${EDIT_NOTE}\n${GET_NOTES}\n${DELETE_NOTE}\n${DELETE_NOTES}`);
        }
    });
}

await start();