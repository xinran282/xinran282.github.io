#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const secretFile = arg('secret-file');
const from = arg('from', process.env.MAIL_USER);
const to = arg('to');
const subject = arg('subject');
const articleFile = arg('article-file');
if (!secretFile || !from || !to || !subject || !articleFile) {
  throw new Error('Usage: send-email.mjs --secret-file path --from email --to email --subject text --article-file path');
}

// The secret file contains only the 163 client authorization code. Never print it.
const authCode = fs.readFileSync(path.resolve(secretFile), 'utf8').trim();
const text = fs.readFileSync(path.resolve(articleFile), 'utf8');
if (!authCode) throw new Error('Secret file is empty');
if (!text.trim()) throw new Error('Article file is empty');

const transporter = nodemailer.createTransport({
  host: 'smtp.163.com',
  port: 465,
  secure: true,
  auth: { user: from, pass: authCode }
});

await transporter.sendMail({ from: `欣 <${from}>`, to, subject, text });
console.log(JSON.stringify({ sent: true, to, subject }));
