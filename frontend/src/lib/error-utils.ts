/**
 * Parse backend error response into a user-friendly message.
 * Handles FastAPI validation errors (with `detail` array) and plain error messages.
 */

type FieldLabelMap = Record<string, string>;

const DEFAULT_FIELD_LABELS: Record<string, FieldLabelMap> = {
  zh: {
    email: "邮箱",
    password: "密码",
    username: "用户名",
    display_name: "显示名称",
    name: "名称",
    namespace: "命名空间",
    description: "描述",
    content: "内容",
    slug: "标识",
    role_ids: "角色",
  },
  en: {
    email: "Email",
    password: "Password",
    username: "Username",
    display_name: "Display name",
    name: "Name",
    namespace: "Namespace",
    description: "Description",
    content: "Content",
    slug: "Slug",
    role_ids: "Roles",
  },
};

const VALIDATION_HINTS: Record<string, Record<string, (ctx: Record<string, unknown>) => string>> = {
  zh: {
    value_error: () => "格式不正确",
    "value_error.email": () => "邮箱地址格式不正确，需包含 @ 符号",
    string_too_short: (ctx) => `至少需要 ${ctx?.min_length || "?"} 个字符`,
    string_too_long: (ctx) => `最多 ${ctx?.max_length || "?"} 个字符`,
    missing: () => "必填项不能为空",
    string_pattern_mismatch: () => "格式不符合要求",
    int_parsing: () => "必须是整数",
    bool_parsing: () => "必须是布尔值",
  },
  en: {
    value_error: () => "Invalid format",
    "value_error.email": () => "Invalid email address (must contain @ sign)",
    string_too_short: (ctx) => `Must be at least ${ctx?.min_length || "?"} characters`,
    string_too_long: (ctx) => `Must be at most ${ctx?.max_length || "?"} characters`,
    missing: () => "This field is required",
    string_pattern_mismatch: () => "Does not match the required format",
    int_parsing: () => "Must be an integer",
    bool_parsing: () => "Must be a boolean",
  },
};

interface ValidationError {
  type?: string;
  loc?: (string | number)[];
  msg?: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

export function parseApiError(error: unknown, locale: "zh" | "en" = "zh"): string {
  if (!error) return locale === "zh" ? "未知错误" : "Unknown error";

  const message = error instanceof Error ? error.message : String(error);
  const fieldLabels = DEFAULT_FIELD_LABELS[locale];
  const hints = VALIDATION_HINTS[locale];

  try {
    const parsed = JSON.parse(message);
    if (parsed.detail) {
      if (Array.isArray(parsed.detail)) {
        const lines = parsed.detail.map((err: ValidationError) => {
          const fieldPath = (err.loc || []).filter((x) => x !== "body").join(".");
          const label = fieldLabels[fieldPath] || fieldPath || (locale === "zh" ? "字段" : "Field");
          let hint: string | null = null;
          if (err.type && hints[err.type]) {
            hint = hints[err.type](err.ctx || {});
          } else if (err.msg) {
            hint = translateMsg(err.msg, locale);
          }
          return `• ${label}: ${hint || err.msg || ""}`;
        });
        return lines.join("\n");
      }
      if (typeof parsed.detail === "string") {
        return translateMsg(parsed.detail, locale);
      }
    }
  } catch {
    // Not JSON, fall through
  }

  return translateMsg(message, locale);
}


function translateMsg(msg: string, locale: "zh" | "en"): string {
  if (locale !== "zh") return msg;

  const translations: Array<[RegExp | string, string]> = [
    [/value is not a valid email address.*/i, "邮箱地址格式不正确"],
    [/An email address must have an @-sign/i, "邮箱地址必须包含 @ 符号"],
    [/String should have at least (\d+) characters?/i, "至少需要 $1 个字符"],
    [/String should have at most (\d+) characters?/i, "最多 $1 个字符"],
    [/Input should be a valid integer/i, "必须是整数"],
    [/Field required/i, "必填项不能为空"],
    [/Invalid credentials/i, "用户名或密码错误"],
    [/Not authenticated/i, "未登录或登录已过期"],
    [/Insufficient permissions/i, "权限不足"],
    [/Rate limit exceeded/i, "请求太频繁，请稍后再试"],
    [/already exists/i, "已存在"],
    [/not found/i, "未找到"],
    [/HTTP 404/i, "未找到资源"],
    [/HTTP 500/i, "服务器内部错误"],
    [/HTTP 502/i, "网关错误"],
    [/HTTP 504/i, "请求超时"],
    [/Network request failed/i, "网络请求失败"],
    [/Failed to fetch/i, "网络请求失败"],
  ];

  for (const [pattern, replacement] of translations) {
    if (typeof pattern === "string") {
      if (msg.includes(pattern)) return replacement;
    } else if (pattern.test(msg)) {
      return msg.replace(pattern, replacement);
    }
  }
  return msg;
}


/**
 * Client-side validation helpers
 */
export function validateEmail(email: string): string | null {
  if (!email) return "email_required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "email_invalid";
  return null;
}

export function validatePassword(pw: string, minLength: number = 6): string | null {
  if (!pw) return "password_required";
  if (pw.length < minLength) return "password_too_short";
  return null;
}

export function validateUsername(name: string, minLength: number = 3): string | null {
  if (!name) return "username_required";
  if (name.length < minLength) return "username_too_short";
  return null;
}

const VALIDATION_MESSAGES: Record<string, Record<string, string>> = {
  zh: {
    email_required: "请输入邮箱",
    email_invalid: "邮箱格式不正确，需要类似 user@example.com",
    password_required: "请输入密码",
    password_too_short: "密码至少 6 位",
    username_required: "请输入用户名",
    username_too_short: "用户名至少 3 位",
  },
  en: {
    email_required: "Email is required",
    email_invalid: "Invalid email format, e.g. user@example.com",
    password_required: "Password is required",
    password_too_short: "Password must be at least 6 characters",
    username_required: "Username is required",
    username_too_short: "Username must be at least 3 characters",
  },
};

export function validationMessage(code: string, locale: "zh" | "en" = "zh"): string {
  return VALIDATION_MESSAGES[locale]?.[code] || code;
}
