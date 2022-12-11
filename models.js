import sequelize from './db.js';
import { DataTypes } from 'sequelize';

const User = sequelize.define('user', {
    id: { type: DataTypes.INTEGER, primaryKey: true, unique: true, autoIncrement: true },
    chatId: { type: DataTypes.STRING, unique: true },
    notes: { type: DataTypes.STRING, defaultValue: '' },
})

export default User;