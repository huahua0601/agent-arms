export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_superadmin: boolean;
  roles: Role[];
  created_at: string;
  updated_at: string | null;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: Permission[];
  created_at: string;
}

export interface Permission {
  id: number;
  resource: string;
  action: string;
  description: string | null;
}

export interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  full_key?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface McpServer {
  id: number;
  name: string;
  namespace: string;
  description: string | null;
  version: string;
  transport_type: string;
  endpoint_url: string | null;
  source_type: string;
  icon_url: string | null;
  owner_id: number;
  status: string;
  downloads: number;
  auth_type: string | null;
  auth_config: Record<string, string> | null;
  tags: Tag[];
  created_at: string;
  updated_at: string | null;
}

export interface McpTool {
  id: number;
  server_id: number;
  name: string;
  description: string | null;
  input_schema: Record<string, unknown>;
}

export interface McpResource {
  id: number;
  server_id: number;
  uri_template: string;
  name: string;
  description: string | null;
  mime_type: string | null;
}

export interface McpPrompt {
  id: number;
  server_id: number;
  name: string;
  description: string | null;
  arguments: Record<string, unknown>;
}

export interface Tag {
  id: number;
  name: string;
}

export interface ServerVersion {
  id: number;
  server_id: number;
  version: string;
  changelog: string | null;
  published_at: string;
}

export interface Instance {
  id: number;
  server_id: number;
  server_name?: string;
  container_id: string | null;
  status: string;
  port: number | null;
  cpu_limit: string | null;
  memory_limit: string | null;
  image: string | null;
  command: string | null;
  started_at: string | null;
  stopped_at: string | null;
  created_at: string;
}

export interface HealthCheck {
  id: number;
  instance_id: number;
  status: string;
  response_time_ms: number | null;
  checked_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  detail: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  created_at: string;
}

export interface Skill {
  id: number;
  name: string;
  namespace: string;
  description: string | null;
  content: string;
  category: string;
  version: string;
  author_id: number;
  author_name: string | null;
  icon_url: string | null;
  status: string;
  is_public: boolean;
  downloads: number;
  parameters: Record<string, unknown> | null;
  trigger_pattern: string | null;
  tags: Tag[];
  created_at: string;
  updated_at: string | null;
}

export interface SkillTag {
  id: number;
  name: string;
}

export interface GatewayCallLog {
  id: number;
  user_id: number | null;
  username: string | null;
  api_key_id: number | null;
  server_id: number | null;
  server_namespace: string | null;
  method: string | null;
  tool_name: string | null;
  request_params: Record<string, unknown> | null;
  response_status: string | null;
  error_message: string | null;
  latency_ms: number | null;
  request_size: number | null;
  response_size: number | null;
  ip_address: string | null;
  created_at: string | null;
}

export interface GatewayOverview {
  total_calls: number;
  today_calls: number;
  success_rate: number;
  avg_latency_ms: number;
  error_count_today: number;
}

export interface GatewayTrendPoint {
  date: string;
  total: number;
  success: number;
  error: number;
}

export interface TopItem {
  name: string;
  value: number;
  extra?: string | null;
}

export interface GatewayErrorItem {
  id: number;
  server_namespace: string | null;
  method: string | null;
  error_message: string | null;
  username: string | null;
  created_at: string | null;
}

export interface Team {
  id: number;
  slug: string;
  display_name: string;
  description: string | null;
  avatar_url: string | null;
  is_personal: boolean;
  require_review: boolean;
  created_by: number;
  member_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface TeamMember {
  id: number;
  user_id: number;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  joined_at: string | null;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
}

export interface ReviewRequest {
  id: number;
  resource_type: string;
  resource_id: number;
  resource_name: string | null;
  team_id: number;
  team_slug: string | null;
  submitter_id: number;
  submitter_name: string | null;
  status: string;
  reviewer_id: number | null;
  reviewer_name: string | null;
  review_comment: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export interface OAuthProvider {
  id: string;
  name: string;
}

export interface OAuthConnection {
  id: number;
  provider: string;
  provider_username: string | null;
  provider_email: string | null;
  created_at: string | null;
}

export interface TunnelToken {
  id: number;
  name: string;
  token_prefix: string;
  server_id: number;
  is_active: boolean;
  last_connected_at: string | null;
  created_at: string;
  full_token?: string;
  is_connected: boolean;
}
