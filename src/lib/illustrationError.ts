// What the phone says when the provider refused to draw a picture. The status is the provider's HTTP code; the detail is
// the provider's own message, already shortened by the server. Both are untrusted and only ever shown as plain text.
export interface FailureView {
  headline: string;
  // The provider's own words, when it gave any.
  providerSays: string | null;
}

function headlineFor(status: number | null): string {
  if (status === null) return "Couldn't generate an image";
  if (status === 429) return "The image provider is limiting your requests. This is usually a usage limit or a cooldown, so try again later.";
  if (status === 401 || status === 403)
    return "The image provider did not accept the request. Check that the API key may use image generation.";
  if (status === 404) return "The image model was not found. Check the image model in the provider settings.";
  if (status === 400 || status === 422)
    return "The image provider rejected the request. The prompt may have been blocked by its content rules, or a usage limit may have been reached.";
  if (status >= 500) return "The image provider had a problem. Try again in a moment.";
  return `Couldn't generate an image (${status})`;
}

export function describeIllustrationFailure(failure: { status: number | null; detail: string }): FailureView {
  const detail = failure.detail.trim();
  return {
    headline: headlineFor(failure.status),
    providerSays: detail ? detail : null,
  };
}
