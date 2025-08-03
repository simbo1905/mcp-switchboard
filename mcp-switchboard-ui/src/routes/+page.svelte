<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let invoke: any;
  let listen: any;

  if (browser) {
    import('@tauri-apps/api/core').then(module => {
      invoke = module.invoke;
    });
    import('@tauri-apps/api/event').then(module => {
      listen = module.listen;
    });
  }

  let messages: { type: 'user' | 'assistant'; content: string }[] = [];
  let inputMessage = '';
  let isStreaming = false;
  let currentResponse = '';
  let apiKey = '';

  onMount(() => {
    if (browser) {
      const setupListeners = async () => {
        await listen('chat-stream', (event: any) => {
          currentResponse += event.payload;
        });

        await listen('chat-complete', () => {
          messages = [...messages, { type: 'assistant', content: currentResponse }];
          currentResponse = '';
          isStreaming = false;
        });

        await listen('chat-error', (event: any) => {
          console.error('Chat error:', event.payload);
          isStreaming = false;
        });
      };

      setupListeners();
    }
  });

  async function sendMessage() {
    if (!inputMessage.trim() || isStreaming || !browser) return;

    const userMessage = { type: 'user' as const, content: inputMessage };
    messages = [...messages, userMessage];
    const messageToSend = inputMessage;
    inputMessage = '';
    isStreaming = true;

    try {
      await invoke('send_streaming_message', {
        message: messageToSend,
        apiKey: apiKey,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      isStreaming = false;
    }
  }
</script>

<div class="chat-interface">
  <div class="api-key-input">
    <input type="password" bind:value={apiKey} placeholder="Enter your Together.ai API Key" />
  </div>
  <div class="messages">
    {#each messages as msg}
      <div class="message {msg.type}">
        <p>{msg.content}</p>
      </div>
    {/each}
    {#if isStreaming && currentResponse}
      <div class="message assistant streaming">
        <p>{currentResponse}</p>
      </div>
    {/if}
  </div>
  <div class="input-area">
    <input
      bind:value={inputMessage}
      on:keypress={(e) => e.key === 'Enter' && sendMessage()}
      disabled={isStreaming || !apiKey}
      placeholder="Type your message..."
    />
    <button on:click={sendMessage} disabled={isStreaming || !apiKey}>
      Send
    </button>
  </div>
</div>

<style>
  .chat-interface {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    border: 1px solid #ccc;
    border-radius: 8px;
    overflow: hidden;
  }

  .api-key-input {
    padding: 10px;
    border-bottom: 1px solid #ccc;
  }

  .api-key-input input {
    width: 100%;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }

  .messages {
    flex-grow: 1;
    padding: 10px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .message {
    margin-bottom: 10px;
    padding: 8px 12px;
    border-radius: 18px;
    max-width: 70%;
  }

  .message.user {
    background-color: #007bff;
    color: white;
    align-self: flex-end;
  }

  .message.assistant {
    background-color: #f0f0f0;
    color: black;
    align-self: flex-start;
  }

  .input-area {
    display: flex;
    padding: 10px;
    border-top: 1px solid #ccc;
  }

  .input-area input {
    flex-grow: 1;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin-right: 10px;
  }

  .input-area button {
    padding: 8px 12px;
    border: none;
    background-color: #007bff;
    color: white;
    border-radius: 4px;
    cursor: pointer;
  }

  .input-area button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
</style>