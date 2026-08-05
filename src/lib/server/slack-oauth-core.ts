export function slackAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("scope", "incoming-webhook");
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  return url.toString();
}
