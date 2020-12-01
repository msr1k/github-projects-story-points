(function (d, w) {
'use strict';

var estimateRegEx = /^\[([\d\.]+)pt\]$/im;

var debounce = function (func, wait, immediate) {
  var timeout;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};

var resetStoryPointsForColumn = (column) => {
  const customElements = Array.from(column.getElementsByClassName('github-project-story-points'));
  for (let e of customElements) {
    const parent = e.parentNode;
    if (parent.dataset.gpspOriginalContent) {
      parent.innerText = parent.dataset.gpspOriginalContent;
      delete parent.dataset.gpspOriginalContent;
    } else {
      parent.removeChild(e);
    }
  }
};

var titleWithTotalPoints = (title, points, unestimated) => {
    var pluralize = (value) => (
      value === 1 ? '' : 's'
    );

    let unestimated_element = "";
    let points_element = "";

    if (unestimated > 0) {
      unestimated_element = `${unestimated} missing estimate`;
    }

    if (points > 0) {
      points_element = `${points}pt`;
    }

    if (points_element && unestimated_element) {
      unestimated_element = `, ${unestimated_element}`;
    }

    return `${title} card${pluralize(title)} <span class="github-project-story-points" style="font-size:xx-small">(${points_element}${unestimated_element})</span>`;
};

var addStoryPointsForColumn = (column) => {
  const columnCards = Array
    .from(column.getElementsByClassName('issue-card'))
    .filter(card => !card.classList.contains('sortable-ghost'))
    .map(card => {
      const estimateLabels = Array
        .from(card.getElementsByClassName('issue-card-label'))
        .filter(label => estimateRegEx.test(label.innerText))

      const firstEstimateText = (
        estimateLabels.length > 0 ? estimateLabels[0].innerText.trim() : null)

      const match = (
        estimateRegEx.exec(firstEstimateText) ||
        [null, '0'])

      const storyPoints = parseFloat(match[1]) || 0;
      const donePoints = card.getElementsByClassName('closed')[0] ? storyPoints : 0;
      const estimated = (match[0] !== null);


      return {
        element: card,
        estimated,
        storyPoints,
        donePoints,
      };
    });
  const columnCountElement = column.getElementsByClassName('js-column-card-count')[0];

  let columnStoryPoints = 0;
  let columnDonePoints = 0;
  let columnUnestimated = 0;

  for (let card of columnCards) {
    columnStoryPoints += card.storyPoints;
    columnDonePoints += card.donePoints;
    columnUnestimated += (card.estimated ? 0 : 1);
  }
  // Apply DOM changes:
  if (columnStoryPoints || columnUnestimated) {
    columnCountElement.innerHTML = titleWithTotalPoints(columnCards.length, columnStoryPoints, columnUnestimated);
  }
  return { points: columnStoryPoints, done: columnDonePoints, unestimated: columnUnestimated };
};

var resets = [];
var total = {};
var dones = {};

const addStoryPointsForAll = (column, points, done) => {
// asdfasdf
  const name = column.getElementsByClassName('js-project-column-name')[0].innerText;
  total = { ...total, [name]: points };
  dones = { ...dones, [name]: done };
  const tp = Object.values(total).reduce((m, p) => m + p, 0);
  const dp = Object.values(dones).reduce((m, p) => m + p, 0);
  let tgt = document.getElementsByClassName('total-point-of-stories')[0];
  if (!tgt) {
    let el = document.getElementsByClassName('project-header-controls')[0].previousElementSibling;
    el = el.getElementsByTagName('button')[0];
    let span = document.createElement("span");
    span.classList.add("total-point-of-stories", "Counter", "Counter--gray-light");
    el.prepend(span);
    tgt = document.getElementsByClassName('total-point-of-stories')[0];
  }
  tgt.innerText = `${dp}pt / ${tp}pt`;
}

var start = debounce(() => {
  // Reset
  for (let reset of resets) {
    reset();
  }
  resets = [];
  // Projects
  const projects = d.getElementsByClassName('project-columns-container');
  if (projects.length > 0) {
    const project = projects[0];
    const columns = Array.from(project.getElementsByClassName('js-project-column')); // Was 'col-project-custom', but that's gitenterprise; github.com is 'project-column', fortunately, both have 'js-project-column'
    for (let column of columns) {
      const addStoryPoints = ((c) => debounce(() => {
        resetStoryPointsForColumn(c);
        const { points, done } = addStoryPointsForColumn(c);
        addStoryPointsForAll(column, points, done);
      }, 50))(column);
      column.addEventListener('DOMSubtreeModified', addStoryPoints);
      column.addEventListener('drop', addStoryPoints);
      const { points, done } = addStoryPointsForColumn(column);
      addStoryPointsForAll(column, points, done);
      resets.push(((c) => () => {
        resetStoryPointsForColumn(c);
        column.removeEventListener('DOMSubtreeModified', addStoryPoints);
        column.removeEventListener('drop', addStoryPoints);
      })(column));
    }
  }
}, 50);

// Hacks to restart the plugin on pushState change
w.addEventListener('statechange', () => setTimeout(() => {
  const timelines = d.getElementsByClassName('new-discussion-timeline');
  if (timelines.length > 0) {
    const timeline = timelines[0];
    const startOnce = () => {
      timeline.removeEventListener('DOMSubtreeModified', startOnce);
      start();
    };
    timeline.addEventListener('DOMSubtreeModified', startOnce);
  }
  start();
}, 500));

// First start
start();

})(document, window);
