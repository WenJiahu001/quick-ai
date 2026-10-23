export const MAX_INPUT_CHARS = 500_000;
export const MAX_CONVERSATION_CHARS = 4_000_000;
export const MAX_CONFIG_BYTES = 2_000_000;
export const MAX_CONFIG_ITEMS = 500;
export const MAX_EVENT_CHARS = 1_000_000;

export function assertConfigurationSize(value) {
  if (Object.values(value).some((item) => Array.isArray(item) && item.length > MAX_CONFIG_ITEMS)) {
    throw new Error(`每类配置最多支持 ${MAX_CONFIG_ITEMS} 项，请精简后重试。`);
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_CONFIG_BYTES) {
    throw new Error("配置内容超过 2 MB，请精简后重试。");
  }
}
