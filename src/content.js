// The last time a refresh of the page was done
var lastRefresh = (new Date()).getTime();
var jiraLogo = chrome.extension.getURL("images/jira.png");
var jiraUrl = undefined;
var prTemplate = '';
var NL = "\r";
chrome.storage.sync.get({
    jiraUrl: '',
    prTemplate: '### Ticket' + NL +
        'Link to ticket: {{TICKETURL}}' + NL +
        NL +
        //'#### Description' +  NL +
        //'{{DESCRIPTION}}' + NL +
        //NL +
        '### What has been done' +  NL +
        '- ' +  NL +
        '- ' +  NL +
        NL +
        '### How to test' +  NL +
        '- ' +  NL +
        '- ' +  NL +
        NL +
        '### Todo' +  NL +
        '- [ ] ' +  NL +
        '- [ ] ' +  NL +
        NL +
        '### Notes' +  NL +
        '- ' +  NL +
        '- '
}, function(items) {
    jiraUrl = items.jiraUrl;
    prTemplate = items.prTemplate;
    if (jiraUrl == '') {
        console.error('GitHub Jira plugin could not load: Jira URL is not set.');
        return;
    }

    //Check login
    var loginResult = $.ajax('https://' + jiraUrl + '/rest/auth/1/session', {async: false}).responseJSON;
    if (loginResult.name == undefined) {
        console.error('You are not logged in to Jira at http://'+jiraUrl+' - Please login.');
        return;
    }

    console.log('Fun fact of the developer console nerd: You have logged in to Jira at least ' + loginResult.loginInfo.loginCount + ' times!');

    // Check page if content changed (for AJAX pages)
    $(document).on('DOMNodeInserted', function() {
        if ((new Date()).getTime() - lastRefresh >= 250) {
            lastRefresh = (new Date()).getTime();
            checkPage();
        }
    });

    // Check page initially
    checkPage();
});

function checkPage() {
    var url = window.location.href;
    if (url.match(/github\.com\/(.*)\/(.*)\/pull\//) != null) {
        //console.log('Specific PR page');
        setTimeout(function() {handlePrPage()}, 200); //Small timeout for dom to finish setup
    }
    if (url.match(/github\.com\/(.*)\/(.*)\/pulls/) != null) {
        //console.log('PR Overview page');
    }

    if (url.match(/github\.com\/(.*)\/(.*)\/compare\/(.*)/) != null) {
        //Create PR page
        setTimeout(function() {handlePrCreatePage()}, 200); //Small timeout for dom to finish setup
    }
}

function handlePrPage() {
    var title = $("h1 > span.js-issue-title").html();
    if (title == undefined || $('a[data-container-id="jira_bucket"]').length > 0) {
        //If we didn't find a ticket, or the data is already inserted, cancel.
        return false;
    }

    var ticketNumber = title.match(/([A-Z]+-[0-9]+)/)[0];
    var ticketUrl = 'https://'+jiraUrl+'/browse/' + ticketNumber;

    //Replace title with clickable link to jira ticket
    $("h1 > span.js-issue-title").html(
        title.replace(
            /([A-Z]+-[0-9]+)/,
            '<a href="'+ticketUrl+'" target="_blank" alt="Ticket in Jira">'+ticketNumber+'</a>'
        )
    );

    //Open up a handle for data
    $('#partial-discussion-header').append(
        '<div id="insertedJiraData">Loading ticket '+ticketNumber+'...</div>'
    );

    //Add another tab for directly viewing the ticket information
    $('div.tabnav.tabnav-pr nav.tabnav-tabs').append(
        '<a href="'+ticketUrl+'" data-container-id="jira_bucket" data-tab="jira" class="tabnav-tab js-pull-request-tab">'+
            '<span class="octicon octicon-credit-card"></span> Jira' +
            '<span id="files_tab_counter" class="counter">' +
            '0' +
            '</span>' +
            '</a>'
    );

    // The tab view
    $('div.view-pull-request').append(
        '<div id="jira_bucket" class="jira-bucket tab-content pull-request-tab-content"></div>'
    );

    // Tab click handle
    $('a[data-tab="jira"]').on('click', function() {
        $('nav.tabnav-tabs a').removeClass('selected');
        $(this).addClass('selected');
        $('div.pull-request-tab-content').removeClass('is-visible');
        $('div#jira_bucket').addClass('is-visible');
        return false;
    });

    //Load up data from jira
    $.ajax({
        url: "https://"+jiraUrl+"/rest/api/latest/issue/" + ticketNumber,
        dataType: "json",
        success: function(result){
            //console.log(result.fields.summary);
            $("#insertedJiraData").html(
                '<div class="flex-table gh-header-meta">' +
                    '<div class="flex-table-item">' +
                    '<div class="state" style="background-color: rgb(150, 198, 222);">' +
                    '<span class="octicon"><img src="'+jiraLogo+'" /></span> Jira' +
                    '</div>' +
                    '</div>' +
                    '<div class="flex-table-item flex-table-item-primary">' +
                    result.fields.summary +
                    '</div>' +
                    '</div>'
            );

            // console.log(result);

            var assignee = result.fields.assignee;
            var reporter = result.fields.reporter;
            var assigneeImage = $.ajax(assignee.self, {async: false}).responseJSON.avatarUrls['48x48'];
            var reporterImage = $.ajax(reporter.self, {async: false}).responseJSON.avatarUrls['48x48'];

            var assigneeText = '<div class="discussion-timeline pull-discussion-timeline js-quote-selection-container ">' +
                '<div class="js-discussion js-socket-channel">' +
                '<div class="timeline-comment-wrapper js-comment-container">' +
                '<a href="#"><img alt="'+assignee.displayName+'" class="timeline-comment-avatar" height="48" src="'+assigneeImage+'" width="48"></a>' +
                '<div class="comment previewable-edit timeline-comment js-comment js-task-list-container">' +
                '<div class="timeline-comment-header ">' +
                '<div class="timeline-comment-header-text">' +
                '<strong><a href="#" class="author">'+assignee.displayName+'</a></strong>' +
                ' is assigned to this task. Last update was ' +
                '<a href="#" class="timestamp">' +
                '<time datetime="'+result.fields.updated+'" is="relative-time" title="'+result.fields.updated+'">'+result.fields.updated+'</time>' +
                '</a>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>';

            var reporterText = '<div class="discussion-timeline pull-discussion-timeline js-quote-selection-container ">' +
                '<div class="js-discussion js-socket-channel">' +
                '<div class="timeline-comment-wrapper js-comment-container">' +
                '<a href="#"><img alt="'+reporter.displayName+'" class="timeline-comment-avatar" height="48" src="'+reporterImage+'" width="48"></a>' +
                '<div class="comment previewable-edit timeline-comment js-comment js-task-list-container">' +
                '<div class="timeline-comment-header ">' +
                '<div class="timeline-comment-header-text">' +
                '<strong><a href="#" class="author">'+reporter.displayName+'</a></strong>' +
                ' is the creator of this task. Task was created ' +
                '<a href="#" class="timestamp">' +
                '<time datetime="'+result.fields.created+'" is="relative-time" title="'+result.fields.created+'">'+result.fields.created+'</time>' +
                '</a>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '</div>';

            $("div#jira_bucket").html(
                assigneeText + reporterText
            );
        }
    });
}

function handlePrCreatePage() {
    var body = $("textarea#pull_request_body");
    if (body.attr('jira-loading') == 1) {
        return false; //Already loading
    }
    body.attr('jira-loading', 1);

    var title = $('div.commitish-suggester > button[aria-label="Choose a head branch"] > span.js-select-button').html();
    var ticketUrl = '**No linked ticket**';
    var ticketDescription = '...';

    if (title != undefined) {
        var titleMatch = title.match(/([a-zA-Z]+-[0-9]+)/);
        if (titleMatch) {
            //Found a title, fetch some info from the ticket
            var ticketNumber = titleMatch[0];
            ticketUrl = 'https://'+jiraUrl+'/browse/' + ticketNumber;

            //Load up data from jira
            $.ajax({
                url: "https://"+jiraUrl+"/rest/api/latest/issue/" + ticketNumber,
                dataType: "json",
                async: false,
                success: function(result) {
                    // console.log(result);
                    $('input#pull_request_title').val('['+ticketNumber.toUpperCase()+'] ' + result.fields.summary);
                    /*ticketDescription = result.fields.description
                        .replace('h1.', '# ')
                        .replace('h2.', '## ')
                        .replace('h3.', '### ')
                        .replace('h4.', '#### ')
                        .replace('h5.', '##### ')
                        .replace('h6.', '###### ')
                        .replace('{code}', '```' + NL)
                        .replace('{{', '``')
                        .replace('}}', '``');*/
                }
            });
        }
    }

    body.val(prTemplate.replace('{{TICKETURL}}', ticketUrl).replace('{{DESCRIPTION}}', ticketDescription));
}