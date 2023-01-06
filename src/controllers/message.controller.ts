const stringSimilarity = require("string-similarity");
import { APP_NAME } from "..";
import { api } from "../configs/chatAPI.config";
import data from "../../data.json";
import {
  getMessagesOfSender,
  saveConversation,
  updateSingleMessageFromSender,
} from "../services/messages.service";
import { ChatResponse, SendMessageOptions } from "chatgpt";
import DataModel from "src/models/data.model";

// Prefix check
const prefix = [
  "Zappy",
  "ZappyBot",
  "Zappy-Bot",
  "Zappy Bot",
  "zappy",
  "zappybot",
  "zappy-bot",
  "zappy bot",
  "gpt",
  "GPT",
  "gpt3",
  "GPT3",
  "gpt-3",
  "GPT-3",
  "bot",
  "Bot",
  "BOT",
  ".",
  "!",
  "?",
  "z",
  "Z",
];

const personalMessageHandler = async (message: any, prompt: any) => {
  const wordMatch = {
    index: -1,
    value: 0,
  };

  data.forEach((res: any, index: number) => {
    const { question } = res;
    const similarity = stringSimilarity.compareTwoStrings(question, prompt);

    if (similarity > wordMatch.value) {
      wordMatch.index = index;
      wordMatch.value = similarity;
    }
  });

  if (wordMatch.value > 0.7) {
    const dataMessage = data[wordMatch.index];

    const { answers } = dataMessage;
    const randomAnswer = answers[Math.floor(Math.random() * answers.length)];

    console.log(`[${APP_NAME}] Answer to ${message.from}: ${randomAnswer}`);

    message.reply(randomAnswer);
    return true;
  }

  return false;
};

export const handler = async (message: any, prompt: any) => {
  try {
    const start = Date.now();

    const messagePrefix = message.body.split(" ")[0];

    const isPrefix = prefix.includes(messagePrefix);

    if (!isPrefix) return;

    console.log(
      `[${APP_NAME}] Received prompt from ` + message.from + ": " + prompt
    );

    // Check if the message is a personal message or not and handles it
    const isHandled = await personalMessageHandler(message, prompt);
    if (isHandled) return;

    // Get previous conversations
    const prevConversation: any = await getMessagesOfSender(message.from);

    let chatOptions: SendMessageOptions = null;
    let hasPreviousConversation: boolean = false;

    if (prevConversation && prevConversation.length > 0) {
      hasPreviousConversation = true;
      chatOptions = {
        conversationId: prevConversation[0].conversation_id,
        parentMessageId: prevConversation[0].parent_message_id,
        action: "next",
      };
    }

    let response: ChatResponse;

    if (hasPreviousConversation || chatOptions) {
      response = await api.sendMessage(prompt, chatOptions);
    }

    if (!hasPreviousConversation || !chatOptions) {
      response = await api.sendMessage(prompt);
    }

    if (!hasPreviousConversation) {
      // Save the conversation
      const conversation: DataModel = {
        last_message: prompt,
        message_id: response.messageId,
        conversation_id: response.conversationId,
        sender_id: message.from,
        last_response: response.response,
        last_message_timestamp: new Date().toISOString(),
        parent_message_id: response.messageId,
      };
      await saveConversation(conversation);
    } else {
      // Update the conversation
      await updateSingleMessageFromSender(
        message.from,
        prompt,
        response.response,
        response.messageId,
        new Date().toISOString()
      );
    }

    console.log(
      `[${APP_NAME}] Answer to ${message.from}: ${response.response}`
    );

    message.reply(response.response);

    const end = Date.now() - start;

    console.log(`[${APP_NAME}] ChatGPT took ` + end + "ms");
  } catch (error: any) {
    console.error(
      `[${APP_NAME}] Failed to send message to ChatGPT API: ` + error
    );
    // message.reply("I'm sorry, I'm not available at the moment to reply. I will as soon as possible.")
  }
};