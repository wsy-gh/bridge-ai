// ES5 polling script for Kindle browser (WebKit 531-534)
// Progressive enhancement — page works without this via meta-refresh
(function () {
  'use strict';

  var thinkingEl = document.querySelector('.thinking-indicator');
  if (!thinkingEl) return;

  var chatId = thinkingEl.getAttribute('data-chat-id');
  var messageId = thinkingEl.getAttribute('data-message-id');
  if (!chatId || !messageId) return;

  // Remove meta-refresh since JS is handling polling
  var metas = document.getElementsByTagName('meta');
  for (var i = metas.length - 1; i >= 0; i--) {
    if (metas[i].getAttribute('http-equiv') === 'refresh') {
      metas[i].parentNode.removeChild(metas[i]);
    }
  }

  var interval = 2000; // Start at 2s
  var maxInterval = 15000; // Cap at 15s
  var timer = null;

  function poll() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/chat/' + chatId + '/status/' + messageId, true);

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;

      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);

          if (data.status === 'complete') {
            // Replace thinking indicator with response
            var html = data.html || '';
            if (data.thinking) {
              html += '<details><summary>Thinking (' + (data.thinkingTokens || 0) + ' tokens)</summary>';
              html += '<div class="mono text-small">' + data.thinking + '</div></details>';
            }
            if (data.tokensIn || data.tokensOut) {
              html += '<div class="message-meta">' + data.tokensIn + ' in / ' + data.tokensOut + ' out tokens</div>';
            }

            var messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            messageDiv.id = 'msg-' + messageId;
            messageDiv.innerHTML = '<div class="message-role">Claude</div><div class="message-content">' + html + '</div>';

            thinkingEl.parentNode.replaceChild(messageDiv, thinkingEl);

            // Show input form (reload page to get fresh form)
            window.location.reload();
            return;
          }

          if (data.status === 'error') {
            thinkingEl.innerHTML = '<p><strong>Error:</strong> ' + (data.error || 'Something went wrong') + '</p>' +
              '<p><a href="/chat/' + chatId + '">Refresh</a></p>';
            return;
          }

          // Still pending — schedule next poll with backoff
          interval = Math.min(interval * 2, maxInterval);
          timer = setTimeout(poll, interval);
        } catch (e) {
          // JSON parse error — retry
          interval = Math.min(interval * 2, maxInterval);
          timer = setTimeout(poll, interval);
        }
      } else {
        // HTTP error — retry with backoff
        interval = Math.min(interval * 2, maxInterval);
        timer = setTimeout(poll, interval);
      }
    };

    xhr.send(null);
  }

  // Start first poll
  timer = setTimeout(poll, interval);
})();
