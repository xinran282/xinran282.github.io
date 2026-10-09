/**
 * WeChat HTML exports sometimes get dropped into a post body as a full document.
 * Browsers still honor <link rel="stylesheet"> and <style> inside that fragment,
 * and those rules use !important on html/body/a, so they restyle the whole site.
 */
hexo.extend.filter.register('before_post_render', (data) => {
  if (!data || typeof data.content !== 'string') return data;
  if (!/<(?:!doctype|html|head|link|style)\b/i.test(data.content)) return data;

  data.content = data.content
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(?:html|body)\b[^>]*>/gi, '');

  return data;
});
