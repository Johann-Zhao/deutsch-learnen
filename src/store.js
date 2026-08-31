/* 学习进度单例：应用内所有模块共享同一 Storage 实例 */

import { Storage } from './storage.js';

export const store = new Storage();
