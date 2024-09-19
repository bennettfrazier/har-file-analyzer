# har-file-analyzer

Analyze HTTP Archive (HAR) files to export, filter, and group the data to JSON

HAR File Analyzer repo can run on its own by simply cloning the repository to your local and then opening the index.html file in the browser.

For more information on how to HAR files should be handled (as it can contain sensitive data such as auth tokens or cookies), see Okta's documentation on [Generating and analyzing HAR files](https://auth0.com/docs/troubleshoot/troubleshooting-tools/generate-and-analyze-har-files).

To run the app, do the following:

1. `git clone https://github.com/bennettfrazier/har-file-analyzer.git`
2. `cd har-file-analyzer`
3. `open index.html`

The app allows you to traverse through the HAR file entries, and export the specific data related to each entry. There is simple filtering, search (which could likely be improved) and multi-selection capabilities. I wrote this app to attempt to unpack HAR entries to view server requests / responses and export with a similar data structure, as Chrome Dev tools will sometimes not display data for custom mimeTypes that actually display JSON.

Under the hood this is using [Water.css](https://watercss.kognise.dev/) for simple styling, [Fuse.js](https://www.fusejs.io/) for fuzzy client-side search, and vanilla JavaScript for JSON tree traversing.

It attempts to handle various mimeTypes, and if it cannot display the resulting data, the HAR analyzer will attempt to display it in an Preformated Text element (pre).

Columns can be toggled and resized in the HAR entries table.

Data can be exported in a group, based on the type of JSON tree node that is selected and applied to multiple HAR entries.

I'm sure there are bugs, as this was created in two nights. Please open issues if you have any problems viewing, traversing, or exporting HAR entry data.

This was inspired by the github repository: [Har-File-Analyzer](https://github.com/JC3/harextract)
