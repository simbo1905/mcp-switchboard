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

  async function logInfo(message: string) {
    if (invoke) {
      try {
        await invoke('log_info', { message });
      } catch (err) {
        console.log('Frontend log:', message);
      }
    }
  }

  let messages: { type: 'user' | 'assistant'; content: string }[] = [];
  let inputMessage = '';
  let isStreaming = false;
  let currentResponse = '';
  let hasApiKey = false;
  let showSetup = false;
  let setupApiKey = '';

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
      checkApiConfig();
    }
  });

  async function checkApiConfig() {
    if (!invoke) return;
    
    try {
      hasApiKey = await invoke('has_api_config');
      if (!hasApiKey) {
        showSetup = true;
      }
    } catch (error) {
      console.error('Failed to check API config:', error);
      showSetup = true;
    }
  }

  async function saveApiKey() {
    if (!setupApiKey.trim() || !invoke) return;
    
    try {
      if (logInfo) logInfo(`User entering API key of length ${setupApiKey.length}`);
      await invoke('save_api_config', { apiKey: setupApiKey });
      hasApiKey = true;
      showSetup = false;
      setupApiKey = '';
      if (logInfo) logInfo('API key configuration completed successfully');
    } catch (error) {
      console.error('Failed to save API config:', error);
      alert('Failed to save API key. Please try again.');
    }
  }

  async function sendMessage() {
    if (!inputMessage.trim() || isStreaming || !browser || !hasApiKey) return;

    const userMessage = { type: 'user' as const, content: inputMessage };
    messages = [...messages, userMessage];
    const messageToSend = inputMessage;
    
    if (logInfo) logInfo(`User sent chat message: "${messageToSend}"`);
    
    inputMessage = '';
    isStreaming = true;

    try {
      await invoke('send_streaming_message', {
        message: messageToSend,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      if (logInfo) logInfo(`Chat message failed: ${error}`);
      isStreaming = false;
    }
  }
</script>

<div class="chat-interface">
  {#if hasApiKey}
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
        disabled={isStreaming}
        placeholder="Type your message..."
      />
      <button on:click={sendMessage} disabled={isStreaming}>
        Send
      </button>
    </div>
  {:else}
    <div class="welcome">
      <h2>Welcome to MCP Switchboard</h2>
      <p>Please configure your Together.ai API key to get started.</p>
      <button on:click={() => showSetup = true} class="setup-btn">
        Configure API Key
      </button>
    </div>
  {/if}
</div>

{#if showSetup}
  <div class="modal-overlay">
    <div class="modal">
      <h3>Configure Together.ai API Key</h3>
      <p>Enter your Together.ai API key to enable AI chat functionality.</p>
      <div class="form-group">
        <label for="api-key">API Key:</label>
        <input
          id="api-key"
          type="password"
          bind:value={setupApiKey}
          placeholder="Enter your Together.ai API Key"
          on:keypress={(e) => e.key === 'Enter' && saveApiKey()}
        />
      </div>
      <div class="modal-actions">
        <button on:click={saveApiKey} disabled={!setupApiKey.trim()}>
          Save
        </button>
        {#if hasApiKey}
          <button on:click={() => showSetup = false} class="secondary">
            Cancel
          </button>
        {/if}
      </div>
      <div class="security-note">
        <small>🔒 Your API key will be encrypted and stored securely on your device.</small>
      </div>
    </div>
  </div>
{/if}

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

  .welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 40px;
    text-align: center;
  }

  .welcome h2 {
    margin-bottom: 16px;
    color: #333;
  }

  .welcome p {
    margin-bottom: 24px;
    color: #666;
  }

  .setup-btn {
    padding: 12px 24px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
  }

  .setup-btn:hover {
    background-color: #0056b3;
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

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: white;
    padding: 24px;
    border-radius: 8px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .modal h3 {
    margin-top: 0;
    margin-bottom: 16px;
    color: #333;
  }

  .modal p {
    margin-bottom: 20px;
    color: #666;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    color: #333;
    font-weight: 500;
  }

  .form-group input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-sizing: border-box;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-bottom: 12px;
  }

  .modal-actions button {
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .modal-actions button:first-child {
    background-color: #007bff;
    color: white;
  }

  .modal-actions button:first-child:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  .modal-actions button.secondary {
    background-color: #f8f9fa;
    color: #333;
    border: 1px solid #ccc;
  }

  .security-note {
    text-align: center;
    color: #666;
    font-size: 12px;
    padding-top: 12px;
    border-top: 1px solid #eee;
  }
</style>