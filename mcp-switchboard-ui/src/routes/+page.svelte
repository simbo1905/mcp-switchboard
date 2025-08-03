<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  let invoke: any;
  let listen: any;

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
  let currentModel = 'Loading...';

  onMount(async () => {
    if (browser) {
      // Wait for Tauri APIs to be available
      const coreModule = await import('@tauri-apps/api/core');
      const eventModule = await import('@tauri-apps/api/event');
      invoke = coreModule.invoke;
      listen = eventModule.listen;

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

      await setupListeners();
      await checkApiConfig();
    }
  });

  async function checkApiConfig() {
    if (!invoke) return;
    
    try {
      hasApiKey = await invoke('has_api_config');
      if (!hasApiKey) {
        showSetup = true;
      } else {
        // Load current model if we have API config
        await loadCurrentModel();
      }
    } catch (error) {
      console.error('Failed to check API config:', error);
      showSetup = true;
    }
  }

  async function loadCurrentModel() {
    if (!invoke) return;
    
    try {
      currentModel = await invoke('get_current_model');
    } catch (error) {
      console.error('Failed to load current model:', error);
      currentModel = 'Unknown';
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

    // Check for chat commands
    if (messageToSend.startsWith('/')) {
      await handleChatCommand(messageToSend);
      return;
    }
    
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

  async function handleChatCommand(command: string) {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    try {
      if (cmd === '/models') {
        if (logInfo) logInfo('User requested models list');
        const models = await invoke('get_available_models');
        const currentModel = await invoke('get_current_model');
        
        let modelList = `📋 **Available Models:**\n\n`;
        modelList += `🎯 **Current:** ${currentModel}\n\n`;
        
        for (const model of models) {
          const current = model.id === currentModel ? ' 👈 *current*' : '';
          modelList += `• **${model.display_name}** (${model.organization})\n`;
          modelList += `  ID: \`${model.id}\`${current}\n\n`;
        }
        modelList += `💡 Use \`/model <model-id>\` to switch models`;
        
        messages = [...messages, { type: 'assistant', content: modelList }];
        
      } else if (cmd === '/model') {
        if (parts.length < 2) {
          messages = [...messages, { 
            type: 'assistant', 
            content: '❌ Please specify a model ID. Usage: `/model <model-id>`\n\nUse `/models` to see available models.' 
          }];
          return;
        }
        
        const modelId = parts.slice(1).join(' ');
        if (logInfo) logInfo(`User switching to model: ${modelId}`);
        
        try {
          await invoke('set_preferred_model', { model: modelId });
          await loadCurrentModel(); // Refresh current model display
          messages = [...messages, { 
            type: 'assistant', 
            content: `✅ **Model switched successfully!**\n\nNow using: \`${modelId}\`` 
          }];
          if (logInfo) logInfo(`Model switched to: ${modelId}`);
        } catch (error) {
          messages = [...messages, { 
            type: 'assistant', 
            content: `❌ **Failed to switch model:** ${error}\n\nUse \`/models\` to see valid model IDs.` 
          }];
        }
        
      } else {
        messages = [...messages, { 
          type: 'assistant', 
          content: `❓ **Unknown command:** ${cmd}\n\n**Available commands:**\n• \`/models\` - List available models\n• \`/model <id>\` - Switch to specific model` 
        }];
      }
    } catch (error) {
      console.error('Command failed:', error);
      messages = [...messages, { 
        type: 'assistant', 
        content: `❌ **Command failed:** ${error}` 
      }];
    }
  }
</script>

<div class="chat-interface">
  {#if hasApiKey}
    <div class="chat-header">
      <h3>🤖 MCP Switchboard</h3>
      <div class="model-display">
        <span class="model-label">Model:</span>
        <span class="model-name">{currentModel}</span>
      </div>
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

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #ddd;
    background-color: #f8f9fa;
  }

  .chat-header h3 {
    margin: 0;
    color: #333;
    font-size: 18px;
  }

  .model-display {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }

  .model-label {
    color: #666;
    font-weight: 500;
  }

  .model-name {
    color: #007bff;
    background-color: #e7f3ff;
    padding: 4px 8px;
    border-radius: 12px;
    font-family: monospace;
    font-size: 12px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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