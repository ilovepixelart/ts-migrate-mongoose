"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
const models_1 = __importDefault(require("../models"));
async function up() {
    const { User } = await (0, models_1.default)();
    // Write migration here
    await User.create([
        {
            firstName: 'John',
            lastName: 'Doe',
        },
        {
            firstName: 'Jane',
            lastName: 'Doe',
        },
    ]);
}
async function down() {
    const { User } = await (0, models_1.default)();
    // Write migration here
    await User.deleteMany({ firstName: { $in: ['Jane', 'John'] } }).exec();
}
//# sourceMappingURL=1673525773572-first-migration-demo.js.map