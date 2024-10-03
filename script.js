let showDetailedView = true;
let allEntries = [];
let displayedEntries = [];
let selectedKeys = {};
let globalSelectedKeys = {};
let selectedEntryIds = new Set();
let fuse;
let allDataForSearch = [];
let exportType = 'standard'; // Can be 'standard' or 'grouped'
let startX, startWidth, resizableTh;


// Call the initialization function when the page loads
document.addEventListener('DOMContentLoaded', function () {
    initializeColumnVisibility();
});

// Initialize column visibility
function initializeColumnVisibility() {
    const toggles = document.querySelectorAll('.column-toggle');
    toggles.forEach(toggle => {
        const column = toggle.dataset.column;
        const isVisible = toggle.checked;
        const headerCell = document.querySelector(`th[data-column="${column}"]`);
        if (headerCell) {
            headerCell.style.display = isVisible ? '' : 'none';
        }
        const cells = document.querySelectorAll(`td[data-column="${column}"]`);
        cells.forEach(cell => {
            cell.style.display = isVisible ? '' : 'none';
        });
    });
}

function updateColumnVisibility() {
    const toggles = document.querySelectorAll('.column-toggle');
    toggles.forEach(toggle => {
        const column = toggle.dataset.column;
        const isVisible = toggle.checked;
        const headerCell = document.querySelector(`th[data-column="${column}"]`);
        if (headerCell) {
            headerCell.style.display = isVisible ? '' : 'none';
        }
        const cells = document.querySelectorAll(`td[data-column="${column}"]`);
        cells.forEach(cell => {
            cell.style.display = isVisible ? '' : 'none';
        });
    });
}

function updateExpandedRows() {
    const expandedRows = document.querySelectorAll('.entry-row.expanded');
    expandedRows.forEach(expRow => {
        const entryId = expRow.dataset.entryId;
        const entry = allEntries.find(e => e.__id === entryId);
        if (entry) {
            // Remove the current expanded row
            const nextRow = expRow.nextSibling;
            if (nextRow && nextRow.classList.contains('expanded-row')) {
                nextRow.parentNode.removeChild(nextRow);
            }
            // Re-expand the row with the updated view
            toggleRowExpansion(expRow, entry, true);
        }
    });
}

function prepareDataForSearch(entries) {
    allDataForSearch = entries.map((entry) => {
        return {
            id: entry.__id,
            entry: entry,
            // Index specific fields for better performance
            searchContent: getSearchableContent(entry)
        };
    });
    const options = {
        keys: ['searchContent'],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 2
    };
    fuse = new Fuse(allDataForSearch, options);
}

function displayEntries(entries) {
    const tbody = document.getElementById('entriesBody');
    tbody.innerHTML = ''; // Clear previous entries

    entries.forEach((entry) => {
        const row = document.createElement('tr');
        row.classList.add('entry-row');
        row.dataset.entryId = entry.__id; // Add this line

        const selectCell = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'select-checkbox';
        checkbox.dataset.id = entry.__id;
        checkbox.checked = selectedEntryIds.has(entry.__id);
        selectCell.appendChild(checkbox);
        selectCell.dataset.column = 'select';
        row.appendChild(selectCell);

        // Started DateTime
        const startedDateTime = document.createElement('td');
        startedDateTime.textContent = entry.startedDateTime || '';
        startedDateTime.dataset.column = 'startedDateTime';
        row.appendChild(startedDateTime);

        // Method
        const method = document.createElement('td');
        method.textContent = entry.request ? entry.request.method : '';
        method.dataset.column = 'method';
        row.appendChild(method);

        // URL without query string
        const url = document.createElement('td');
        let urlText = entry.request ? entry.request.url : '';
        let urlWithoutQuery = urlText;
        try {
            const parsedUrl = new URL(urlText);
            urlWithoutQuery = parsedUrl.origin + parsedUrl.pathname;
        } catch (e) {
            // If parsing fails, fallback to original URL
            urlWithoutQuery = urlText;
        }
        url.textContent = urlWithoutQuery;
        url.title = urlText; // Show full URL on hover
        url.dataset.column = 'url';
        row.appendChild(url);

        // Query String
        const queryString = document.createElement('td');
        queryString.textContent = getQueryString(entry.request ? entry.request.queryString : []);
        queryString.title = queryString.textContent;
        queryString.dataset.column = 'queryString';
        row.appendChild(queryString);

        // Status
        const status = document.createElement('td');
        status.textContent = entry.response ? entry.response.status : '';
        status.dataset.column = 'status';
        row.appendChild(status);

        // Status Text
        const statusText = document.createElement('td');
        statusText.textContent = entry.response ? entry.response.statusText : '';
        statusText.dataset.column = 'statusText';
        row.appendChild(statusText);

        // Time
        const time = document.createElement('td');
        time.textContent = entry.time || '';
        time.dataset.column = 'time';
        row.appendChild(time);

        // Avoid triggering the row click when clicking on the checkbox
        checkbox.addEventListener('click', function (event) {
            event.stopPropagation();
            if (checkbox.checked) {
                selectedEntryIds.add(entry.__id);
            } else {
                selectedEntryIds.delete(entry.__id);
            }
        });

        row.addEventListener('click', function () {
            toggleRowExpansion(row, entry);
        });

        tbody.appendChild(row);
    });

    updateColumnVisibility();
    makeColumnsResizable(); // Initialize resizers after rendering entries
}

function getQueryString(queryArray) {
    return queryArray.map(q => `${q.name}=${q.value}`).join('&');
}

function getSearchableContent(entry) {
    const content = [];
    // Include relevant fields for searching
    if (entry.request) {
        content.push(entry.request.method);
        content.push(entry.request.url);
        if (entry.request.headers) {
            entry.request.headers.forEach(header => {
                content.push(header.name + ': ' + header.value);
            });
        }
        if (entry.request.queryString) {
            entry.request.queryString.forEach(param => {
                content.push(param.name + '=' + param.value);
            });
        }
        if (entry.request.postData && entry.request.postData.text) {
            content.push(entry.request.postData.text);
        }
    }
    if (entry.response) {
        content.push(entry.response.status + ' ' + entry.response.statusText);
        if (entry.response.headers) {
            entry.response.headers.forEach(header => {
                content.push(header.name + ': ' + header.value);
            });
        }
        if (entry.response.content && entry.response.content.text) {
            let responseBody = entry.response.content.text;
            // Decode if necessary
            if (entry.response.content.encoding === 'base64') {
                try {
                    responseBody = atob(responseBody);
                } catch (e) {
                    console.error('Failed to decode base64 response content:', e);
                }
            }
            content.push(responseBody);
        }
    }
    // Include any other properties you find relevant
    if (entry._initiator && entry._initiator.url) {
        content.push(entry._initiator.url);
    }

    // Flatten the content array into a single string
    return content.join(' ');
}

function toggleRowExpansion(row, entry, isUpdating = false) {
    const isExpanded = row.classList.contains('expanded');
    if (isExpanded && !isUpdating) {
        // Collapse the row
        const nextRow = row.nextSibling;
        if (nextRow && nextRow.classList.contains('expanded-row')) {
            nextRow.parentNode.removeChild(nextRow);
        }
        row.classList.remove('expanded'); // Remove the class
    } else {
        // Collapse other expanded rows if not updating
        if (!isUpdating) {
            const expandedRows = document.querySelectorAll('.entry-row.expanded');
            expandedRows.forEach(expRow => {
                expRow.classList.remove('expanded');
                const nextRow = expRow.nextSibling;
                if (nextRow && nextRow.classList.contains('expanded-row')) {
                    nextRow.parentNode.removeChild(nextRow);
                }
            });
            // Reset selectedKeys for the new entry
            selectedKeys = {};
        }

        // Remove existing expanded row if any
        const nextRow = row.nextSibling;
        if (nextRow && nextRow.classList.contains('expanded-row')) {
            nextRow.parentNode.removeChild(nextRow);
        }

        // Expand the current row
        const expandedRow = document.createElement('tr');
        expandedRow.classList.add('expanded-row');
        const expandedCell = document.createElement('td');
        expandedCell.colSpan = row.children.length;
        const expandedContent = document.createElement('div');
        expandedContent.classList.add('expanded-content');

        // Build JSON tree
        const jsonTreeContainer = document.createElement('div');
        jsonTreeContainer.classList.add('json-tree');
        const seen = new Set();
        const dataRoot = entry; // Set dataRoot for use in buildJsonTree
        buildJsonTree(jsonTreeContainer, entry, [], seen, dataRoot);

        // Add buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('button-container');

        const applySelectionButton = document.createElement('button');
        applySelectionButton.textContent = 'Apply Selection to All Entries';
        applySelectionButton.addEventListener('click', function (event) {
            event.stopPropagation();
            globalSelectedKeys = JSON.parse(JSON.stringify(selectedKeys));
            alert('Selection applied to all entries.');
        });
        buttonContainer.appendChild(applySelectionButton);

        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Download This Entry';
        downloadButton.addEventListener('click', function (event) {
            event.stopPropagation();
            const selectedData = getSelectedData(entry, selectedKeys, [], new Set(), entry);
            if (selectedData === undefined) {
                alert('No data selected for this entry.');
                return;
            }
            downloadJSON(selectedData, 'entry.json');
        });
        buttonContainer.appendChild(downloadButton);

        expandedContent.appendChild(buttonContainer);
        expandedContent.appendChild(jsonTreeContainer);
        expandedCell.appendChild(expandedContent);
        expandedRow.appendChild(expandedCell);

        row.parentNode.insertBefore(expandedRow, row.nextSibling);
        row.classList.add('expanded');
    }
}

function buildJsonTree(container, data, path, seen, dataRoot) {
    // Ensure path, seen, and dataRoot are provided
    if (!path) path = [];
    if (!seen) seen = new Set();
    if (!dataRoot) dataRoot = data;
    if (typeof data === 'object' && data !== null) {
        if (seen.has(data)) {
            // Circular reference detected
            const circularRef = document.createElement('span');
            circularRef.textContent = ' (circular reference)';
            container.appendChild(circularRef);
            return;
        }
        seen.add(data);
    }

    const ul = document.createElement('ul');

    if (!showDetailedView) {
        // Show only response.content.text
        // When accessing response.content
        const responseContent = getValueAtPath(dataRoot, ['response', 'content']);
        if (responseContent && typeof responseContent.text !== 'undefined' && responseContent.text !== null) {
            let responseContentText = responseContent.text;
            const fullPath = ['response', 'content', 'text'];
            let value = responseContentText;
            let isObject = typeof value === 'object' && value !== null;

            // Additional logging for debugging
            console.log(`Processing response.content.text for entry ID: ${dataRoot.__id}`);

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.path = JSON.stringify(fullPath);
            checkbox.checked = getSelectedKey(fullPath);

            checkbox.addEventListener('change', function (event) {
                event.stopPropagation();
                setSelectedKey(fullPath, checkbox.checked);
                if (checkbox.checked && isObject) {
                    selectAllChildNodes(value, fullPath);
                }
            });

            const li = document.createElement('li');
            li.appendChild(checkbox);

            const keySpan = document.createElement('span');
            keySpan.textContent = 'response.content.text';
            li.appendChild(keySpan);

            // Handle parsing and displaying the text content
            let parsedValue;
            let parsingSucceeded = false;

            // Check if the content is JSON
            let textContent = value;

            if (responseContent.encoding === 'base64') {
                try {
                    textContent = atob(value);
                } catch (e) {
                    console.warn('Failed to decode base64 content:', e);
                }
            }

            let mimeType = responseContent.mimeType || 'text/plain';

            if (mimeType.includes('json') || mimeType.includes('UTF-8')) {
                try {
                    parsedValue = JSON.parse(textContent);
                    parsingSucceeded = true;
                } catch (e) {
                    console.warn('Failed to parse JSON from text field:', e);
                }
            }

            if (parsingSucceeded) {
                // Display as a nested JSON tree
                isObject = true;
                value = parsedValue;

                const expandToggle = document.createElement('span');
                expandToggle.className = 'expand-toggle';
                expandToggle.textContent = '';
                expandToggle.addEventListener('click', function (event) {
                    event.stopPropagation();
                    li.classList.toggle('expanded');
                    childUl.classList.toggle('hidden');
                });
                li.insertBefore(expandToggle, keySpan.nextSibling);

                const childUl = document.createElement('ul');
                childUl.className = 'hidden';
                buildJsonTree(childUl, value, fullPath, seen, dataRoot);
                li.appendChild(childUl);
            } else {
                // Display the formatted string
                const pre = document.createElement('pre');
                pre.textContent = formatJSONString(textContent);

                addCopyButtonToPre(pre);
                li.appendChild(pre);
            }

            ul.appendChild(li);
        } else {
            const li = document.createElement('li');
            li.textContent = 'No response content available.';
            ul.appendChild(li);
        }
    } else {
        // Detailed view: display the full data
        if (Array.isArray(data)) {
            data.forEach((item, index) => {
                const li = document.createElement('li');
                const fullPath = path.concat(index);

                const isObject = typeof item === 'object' && item !== null;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.path = JSON.stringify(fullPath);
                checkbox.checked = getSelectedKey(fullPath);

                checkbox.addEventListener('change', function (event) {
                    event.stopPropagation();
                    setSelectedKey(fullPath, checkbox.checked);
                    if (checkbox.checked && isObject) {
                        selectAllChildNodes(item, fullPath);
                    }
                });

                li.appendChild(checkbox);

                const keySpan = document.createElement('span');
                keySpan.textContent = `[${index}]`;
                keySpan.classList.add('array-key');
                li.appendChild(keySpan);

                if (isObject) {
                    const expandToggle = document.createElement('span');
                    expandToggle.className = 'expand-toggle';
                    expandToggle.textContent = '';
                    expandToggle.addEventListener('click', function (event) {
                        event.stopPropagation();
                        li.classList.toggle('expanded');
                        childUl.classList.toggle('hidden');
                    });
                    li.insertBefore(expandToggle, keySpan.nextSibling);

                    const childUl = document.createElement('ul');
                    childUl.className = 'hidden';
                    buildJsonTree(childUl, item, fullPath, seen, dataRoot);
                    li.appendChild(childUl);
                } else {
                    li.appendChild(document.createTextNode(`: ${item}`));
                }

                ul.appendChild(li);
            });
        } else {
            for (const key in data) {
                if (!Object.prototype.hasOwnProperty.call(data, key)) continue;

                const li = document.createElement('li');
                const fullPath = path.concat(key);

                let value = data[key];
                let isObject = typeof value === 'object' && value !== null;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset.path = JSON.stringify(fullPath);
                checkbox.checked = getSelectedKey(fullPath);

                checkbox.addEventListener('change', function (event) {
                    event.stopPropagation();
                    setSelectedKey(fullPath, checkbox.checked);
                    if (checkbox.checked && isObject) {
                        selectAllChildNodes(value, fullPath);
                    }
                });

                li.appendChild(checkbox);

                const keySpan = document.createElement('span');
                keySpan.textContent = key;
                li.appendChild(keySpan);

                // Handle 'text' field parsing as before
                if (key === 'text' && typeof value === 'string') {
                    const parentPath = path.slice(0, -1);
                    const parentData = getValueAtPath(dataRoot, parentPath);

                    let textContent = value;

                    if (parentData && parentData.encoding === 'base64') {
                        try {
                            textContent = atob(value);
                        } catch (e) {
                            console.warn('Failed to decode base64 content:', e);
                        }
                    }

                    let mimeType = parentData && parentData.mimeType ? parentData.mimeType : 'text/plain';
                    let parsedValue;
                    let parsingSucceeded = false;

                    if (mimeType.includes('json')) {
                        try {
                            parsedValue = JSON.parse(textContent);
                            parsingSucceeded = true;
                        } catch (e) {
                            console.warn('Failed to parse JSON from text field:', e);
                        }
                    }

                    if (mimeType.includes('charset=UTF-8')) {
                        console.log('mimeType.includes(charset=UTF-8)');
                        try {
                            parsedValue = decodeURIComponent(value);
                            console.log('parsedValue', parsedValue);
                            parsingSucceeded = true;
                        } catch (e) {
                            console.warn('Failed to decode content:', value);
                        }
                    }

                    // last try with a custom mimeType unescaping, that is actually utf-8 encoded json but doesn't say it
                    else {
                        try {
                            parsedValue = recursiveUnescape(value);
                            parsingSucceeded = true;
                        } catch (e) {
                            console.warn('Failed to decode content:', value);
                        }
                    }

                    if (parsingSucceeded) {
                        // Display as a nested JSON tree
                        isObject = true;
                        value = parsedValue;

                        const expandToggle = document.createElement('span');
                        expandToggle.className = 'expand-toggle';
                        expandToggle.textContent = '';
                        expandToggle.addEventListener('click', function (event) {
                            event.stopPropagation();
                            li.classList.toggle('expanded');
                            childUl.classList.toggle('hidden');
                        });
                        li.insertBefore(expandToggle, keySpan.nextSibling);

                        const childUl = document.createElement('ul');
                        childUl.className = 'hidden';
                        buildJsonTree(childUl, value, fullPath, seen, dataRoot);
                        li.appendChild(childUl);
                    } else {
                        // Display the formatted string
                        const pre = document.createElement('pre');
                        pre.textContent = formatJSONString(textContent);
                        addCopyButtonToPre(pre);
                        li.appendChild(pre);
                    }
                } else if (isObject) {
                    const expandToggle = document.createElement('span');
                    expandToggle.className = 'expand-toggle';
                    expandToggle.textContent = '';
                    expandToggle.addEventListener('click', function (event) {
                        event.stopPropagation();
                        li.classList.toggle('expanded');
                        childUl.classList.toggle('hidden');
                    });
                    li.insertBefore(expandToggle, keySpan.nextSibling);

                    const childUl = document.createElement('ul');
                    childUl.className = 'hidden';
                    buildJsonTree(childUl, value, fullPath, seen, dataRoot);
                    li.appendChild(childUl);
                } else {
                    li.appendChild(document.createTextNode(`: ${value}`));
                }

                ul.appendChild(li);
            }
        }
    }

    container.appendChild(ul);
}

function addCopyButtonToPre(preElement) {
    // Check if the element is a <pre>
    if (!(preElement instanceof HTMLElement) || preElement.tagName.toLowerCase() !== 'pre') {
        console.error('addCopyButtonToPre: Provided element is not a <pre> element.');
        return;
    }

    // Avoid adding multiple buttons to the same <pre>
    if (preElement.querySelector('.copy-button')) {
        console.warn('addCopyButtonToPre: <pre> element already has a copy button.');
        return;
    }

    // Create the button element
    const button = document.createElement('button');
    button.className = 'copy-button';
    button.textContent = 'Copy';

    // Define the copy action
    button.addEventListener('click', async () => {
        // Disable the button to prevent multiple clicks
        button.disabled = true;

        try {
            // Clone the <pre> element to exclude the button's text
            const clone = preElement.cloneNode(true);
            const buttonInClone = clone.querySelector('.copy-button');
            if (buttonInClone) {
                buttonInClone.remove(); // Remove the button from the clone
            }

            // Get the text content from the cloned <pre>
            const textToCopy = clone.textContent.trim();

            // Use the Clipboard API if available
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                // Fallback method for older browsers
                const textarea = document.createElement('textarea');
                textarea.value = textToCopy;
                // Prevent scrolling to bottom
                textarea.style.position = 'fixed';
                textarea.style.top = '0';
                textarea.style.left = '-9999px';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();

                const successful = document.execCommand('copy');
                if (!successful) throw new Error('Failed to copy text');

                document.body.removeChild(textarea);
            }

            // Provide feedback to the user
            button.textContent = 'Copied!';
            button.classList.add('copied');

            // Revert the button text after 2 seconds
            setTimeout(() => {
                button.textContent = 'Copy';
                button.classList.remove('copied');
                button.disabled = false;
            }, 2000);
        } catch (err) {
            console.error('Error copying text: ', err);
            alert('Failed to copy text. Please try again.');
            button.disabled = false;
        }
    });

    // Append the button to the <pre> element
    preElement.appendChild(button);
}

function formatJSONString(jsonString) {
    try {
        const jsonObj = JSON.parse(jsonString);
        return JSON.stringify(jsonObj, null, 2);
    } catch (e) {
        // If parsing fails, return the original string
        return jsonString;
    }
}

function unescapeNestedJson(s) {
    try {
        return JSON.parse(s);
    } catch (error) {
        return s.replace(/\\"/g, '"');
    }
}

function recursiveUnescape(obj) {
    if (typeof obj === 'string') {
        // Throw an error for a specific test case
        if (obj.includes('TEST_FAIL_CONDITION')) {
            throw new Error('Test failure condition met');
        }
        return unescapeNestedJson(obj);
    } else if (Array.isArray(obj)) {
        return obj.map(recursiveUnescape);
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [k, recursiveUnescape(v)])
        );
    } else {
        return obj;
    }
}

function convertUTF8ToJSON(value) {
    try {
        // First, try to decode the string using UTF-8
        const decodedString = new TextDecoder('utf-8').decode(new Uint8Array(value.split('').map(c => c.charCodeAt(0))));

        // If successful, parse it as JSON
        return JSON.parse(decodedString);
    } catch (e) {
        console.warn('Failed to decode or parse content:', e.message);

        // If decoding or parsing fails, return the original value
        return value;
    }
}

function selectAllChildNodes(data, path) {
    const stack = [{ data, path }];
    let localSeen = new Set();

    while (stack.length > 0) {
        const { data: currentData, path: currentPath } = stack.pop();
        if (typeof currentData !== 'object' || currentData === null) continue;

        if (localSeen.has(currentData)) continue;
        localSeen.add(currentData);

        if (Array.isArray(currentData)) {
            currentData.forEach((item, index) => {
                const fullPath = currentPath.concat(index);
                setSelectedKey(fullPath, true);
                if (typeof item === 'object' && item !== null) {
                    stack.push({ data: item, path: fullPath });
                }
            });
        } else {
            for (const key in currentData) {
                if (!Object.prototype.hasOwnProperty.call(currentData, key)) continue;
                const fullPath = currentPath.concat(key);
                setSelectedKey(fullPath, true);
                if (typeof currentData[key] === 'object' && currentData[key] !== null) {
                    stack.push({ data: currentData[key], path: fullPath });
                }
            }
        }
    }
}

function setSelectedKey(path, isSelected) {
    const pathStr = JSON.stringify(path);
    if (isSelected) {
        selectedKeys[pathStr] = true;
    } else {
        delete selectedKeys[pathStr];
    }
}

function getSelectedKey(path) {
    const pathStr = JSON.stringify(path);
    return selectedKeys.hasOwnProperty(pathStr);
}

function getSelectedData(data, selectionKeys, path = [], seen = new Set(), dataRoot = data) {
    if (typeof data === 'object' && data !== null) {
        if (seen.has(data)) {
            // Circular reference detected
            return undefined;
        }
        seen.add(data);
    }

    const pathStr = JSON.stringify(path);

    if (selectionKeys[pathStr]) {
        // If the current path is selected, return the data at this path

        // Check if the current path ends with 'text' and the data is a string
        if (path[path.length - 1] === 'text' && typeof data === 'string') {
            // Check if the parent object has an 'encoding' field
            const parentPath = path.slice(0, -1);
            const parentData = getValueAtPath(dataRoot, parentPath);

            let textContent = data;
            // Check if encoding is 'base64'
            if (parentData && parentData.encoding === 'base64') {
                try {
                    textContent = atob(data);
                } catch (e) {
                    console.warn('Failed to decode base64 content:', e);
                }
            }

            // Attempt to parse the JSON string
            try {
                const parsedData = JSON.parse(textContent);
                return parsedData;
            } catch (e) {
                console.warn('Failed to parse JSON from text field:', e);
                return textContent;
            }
        } else {
            return data;
        }
    }

    if (typeof data !== 'object' || data === null) {
        return undefined;
    }

    let hasSelectedChild = false;
    let result = Array.isArray(data) ? [] : {};

    if (Array.isArray(data)) {
        for (let index = 0; index < data.length; index++) {
            const childPath = path.concat(index);
            const childData = getSelectedData(data[index], selectionKeys, childPath, seen, dataRoot);
            if (childData !== undefined) {
                result[index] = childData;
                hasSelectedChild = true;
            }
        }
    } else {
        for (const key in data) {
            if (!Object.prototype.hasOwnProperty.call(data, key)) continue;

            const childPath = path.concat(key);
            const childData = getSelectedData(data[key], selectionKeys, childPath, seen, dataRoot);
            if (childData !== undefined) {
                result[key] = childData;
                hasSelectedChild = true;
            }
        }
    }

    if (hasSelectedChild) {
        return result;
    } else {
        return undefined;
    }
}

function getValueAtPath(dataRoot, path) {
    let value = dataRoot;
    for (const key of path) {
        if (value && typeof value === 'object') {
            value = value[key];
        } else {
            return undefined;
        }
    }
    return value;
}

function collectGroupedData(data, selectionKeys, groupedData, path = [], seen = new Set(), dataRoot = data) {
    if (typeof data === 'object' && data !== null) {
        if (seen.has(data)) {
            // Circular reference detected
            return;
        }
        seen.add(data);
    }

    const pathStr = JSON.stringify(path);

    if (selectionKeys[pathStr]) {
        const key = path.join('.');

        let valueToAdd = data;

        // Check if the current path ends with 'text' and the data is a string
        if (path[path.length - 1] === 'text' && typeof data === 'string') {
            // Check if the parent object has an 'encoding' field
            const parentPath = path.slice(0, -1);
            const parentData = getValueAtPath(dataRoot, parentPath);

            let textContent = data;
            // Check if encoding is 'base64'
            if (parentData && parentData.encoding === 'base64') {
                try {
                    textContent = atob(data);
                } catch (e) {
                    console.warn('Failed to decode base64 content:', e);
                }
            } else if (parentData && parentData.encoding === 'utf-8') {
                try {
                    textContent = decodeURIComponent(data);
                } catch (e) {
                    console.warn('Failed to decode content:', e);
                }
            }

            // Attempt to parse the JSON string
            try {
                valueToAdd = JSON.parse(textContent);
            } catch (e) {
                try {
                    valueToAdd = recursiveParse(textContent);
                } catch (e) {
                    console.warn('Failed to parse JSON from text field:', e);
                    valueToAdd = textContent; // Keep data as is (the original string)
                }
            }
        } else {
            // Deep copy the data to avoid reference issues
            valueToAdd = JSON.parse(JSON.stringify(data));
        }

        if (!groupedData[key]) {
            groupedData[key] = [];
        }
        groupedData[key].push(valueToAdd);
        return; // Do not go deeper once the selected node is found
    }

    if (typeof data !== 'object' || data === null) {
        return;
    }

    if (Array.isArray(data)) {
        for (let index = 0; index < data.length; index++) {
            const childPath = path.concat(index);
            collectGroupedData(data[index], selectionKeys, groupedData, childPath, seen, dataRoot);
        }
    } else {
        for (const key in data) {
            if (!Object.prototype.hasOwnProperty.call(data, key)) continue;

            const childPath = path.concat(key);
            collectGroupedData(data[key], selectionKeys, groupedData, childPath, seen, dataRoot);
        }
    }
}

function recursiveParse(input) {
    // If input is not a string, return it as is
    if (typeof input !== 'string') {
        return input;
    }

    // Remove surrounding quotes if present
    if (input.startsWith('"') && input.endsWith('"')) {
        input = input.slice(1, -1);
    }

    // Replace escaped quotes with actual quotes
    input = input.replace(/\\"/g, '"');

    try {
        // Parse the JSON string
        const parsed = JSON.parse(input);

        // If parsed is an object, recursively parse its properties
        if (typeof parsed === 'object' && parsed !== null) {
            for (const key in parsed) {
                parsed[key] = recursiveParse(parsed[key]);
            }
        }

        return parsed;
    } catch (e) {
        // If parsing fails, return the unescaped string
        return input;
    }
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);


    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}

// Make table columns resizable
function makeColumnsResizable() {
    const table = document.getElementById('entriesTable');
    const cols = table.querySelectorAll('th');
    cols.forEach(function (th) {
        const resizer = th.querySelector('.resizer');
        if (resizer && !resizer.dataset.initialized) {
            resizer.addEventListener('mousedown', initResize);
            resizer.dataset.initialized = true; // Prevent multiple listeners
        }
    });
}

function initResize(e) {
    startX = e.clientX;
    resizableTh = e.target.parentElement;
    startWidth = resizableTh.offsetWidth;
    document.addEventListener('mousemove', resizeColumn);
    document.addEventListener('mouseup', stopResize);
}

function resizeColumn(e) {
    const newWidth = startWidth + (e.clientX - startX);
    resizableTh.style.width = newWidth + 'px';
}

function stopResize() {
    document.removeEventListener('mousemove', resizeColumn);
    document.removeEventListener('mouseup', stopResize);
}

// TODO: Implement search results display if helpful
function displaySearchResults(results) {
    // Implementation of search results display (if needed)
}

// Page event listeners
document.getElementById('filter').addEventListener('input', function (event) {
    const searchTerm = event.target.value.trim();
    if (searchTerm.length >= 2) {
        const results = fuse.search(searchTerm);
        displayedEntries = results.map(result => allEntries.find(e => e.__id === result.item.id));
        displayEntries(displayedEntries);
        displaySearchResults(results);
    } else {
        displayedEntries = allEntries;
        displayEntries(displayedEntries);
        document.getElementById('searchResults').style.display = 'none';
    }
});

document.getElementById('downloadSelected').addEventListener('click', function () {
    if (selectedEntryIds.size === 0) {
        alert('No entries selected.');
        return;
    }

    if (Object.keys(globalSelectedKeys).length === 0) {
        alert('No data selected to download. Please apply a selection to all entries.');
        return;
    }

    const selectedEntries = Array.from(selectedEntryIds).map(id => {
        return allEntries.find(entry => entry.__id === id);
    });

    if (exportType === 'standard') {
        const combinedData = selectedEntries.map(entry => {
            const selectedData = getSelectedData(entry, globalSelectedKeys, [], new Set(), entry);
            return selectedData !== undefined ? selectedData : null;
        }).filter(data => data !== null);

        if (combinedData.length === 0) {
            alert('No data matched the selection in the selected entries.');
            return;
        }

        // Recursively unescape all string values in the combined data
        const unescapeCombinedData = (data) => {
            if (Array.isArray(data)) {
                return data.map(item => unescapeCombinedData(item));
            } else if (typeof data === 'object' && data !== null) {
                const unescapedObj = {};
                for (const [key, value] of Object.entries(data)) {
                    unescapedObj[key] = unescapeCombinedData(value);
                }
                return unescapedObj;
            } else if (typeof data === 'string') {
                try {
                    return recursiveUnescape(data);
                } catch (e) {
                    console.warn('Failed to unescape string:', data);
                    return data;
                }
            } else {
                return data;
            }
        };

        const unescapedCombinedData = unescapeCombinedData(combinedData);

        // function extractDataByKeys(data, parentIdentifier, keys) {
        //     const result = [];

        //     // If type is array, extract data from each item in the array
        //     if (Array.isArray(data)) {
        //         data.forEach(item => {
        //             extractDataByKeys(item, parentIdentifier, keys);
        //         });
        //     }

        //     function traverse(node, currentPath) {
        //         if (typeof node !== 'object' || node === null) return;

        //         if (currentPath.join('.') === parentIdentifier) {
        //             const extractedData = {};
        //             keys.forEach(key => {
        //                 if (node.hasOwnProperty(key)) {
        //                     extractedData[key] = node[key];
        //                 }
        //             });
        //             result.push(extractedData);
        //         }

        //         for (const key in node) {
        //             if (node.hasOwnProperty(key)) {
        //                 traverse(node[key], currentPath.concat(key));
        //             }
        //         }
        //     }

        //     traverse(data, []);
        //     return result;
        // }

        // const parentIdentifier = "response.content.text.included";
        // const keysToExtract = ["firstName", "lastName", "headline"];
        // const extractedData = extractDataByKeys(unescapedCombinedData, parentIdentifier, keysToExtract);

        // console.log('Extracted Data:', extractedData);

        downloadJSON(unescapedCombinedData, 'selected_entries.json');
    } else if (exportType === 'grouped') {
        const groupedData = {};

        selectedEntries.forEach(entry => {
            collectGroupedData(entry, globalSelectedKeys, groupedData, [], new Set(), entry);
        });

        if (Object.keys(groupedData).length === 0) {
            alert('No data matched the selection in the selected entries.');
            return;
        }

        let filename = 'grouped_selected_entries.json';

        // If only one path is selected, rename the filename
        const selectedPaths = Object.keys(groupedData);
        if (selectedPaths.length === 1) {
            const selectionScope = selectedPaths[0].replace(/\./g, '-');
            filename = `${selectionScope}.json`;
            // If the groupedData only contains one array, unwrap it
            groupedData = groupedData[selectedPaths[0]];
        }

        downloadJSON(groupedData, filename);
    }
});


// Reset Selection functionality
document.getElementById('resetSelection').addEventListener('click', function () {
    selectedKeys = {};
    globalSelectedKeys = {};
    selectedEntryIds.clear();
    // Uncheck all checkboxes
    const checkboxes = document.querySelectorAll('.select-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    alert('All selections have been reset.');
});

// Select All functionality
document.getElementById('selectAll').addEventListener('change', function (event) {
    const isChecked = event.target.checked;
    const checkboxes = document.querySelectorAll('.select-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        const id = checkbox.dataset.id;
        if (isChecked) {
            selectedEntryIds.add(id);
        } else {
            selectedEntryIds.delete(id);
        }
    });
});

// Column visibility toggle
const columnToggles = document.querySelectorAll('.column-toggle');
columnToggles.forEach(toggle => {
    toggle.addEventListener('change', updateColumnVisibility);
});

document.getElementById('toggleExportType').addEventListener('click', function () {
    if (exportType === 'standard') {
        exportType = 'grouped';
        this.textContent = 'Switch to Standard Export';
    } else {
        exportType = 'standard';
        this.textContent = 'Switch to Grouped Export';
    }
});

document.getElementById('toggleViewMode').addEventListener('click', function () {
    showDetailedView = !showDetailedView;
    if (showDetailedView) {
        this.textContent = 'Show Response Content Only';
    } else {
        this.textContent = 'Show Full Data';
    }
    // Update any expanded rows to reflect the new view mode
    updateExpandedRows();
});

document.getElementById('fileInput').addEventListener('change', function (event) {
    if (event.target.files.length === 0) {
        alert('No file selected.');
        return;
    }
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const harData = JSON.parse(e.target.result);
            if (!harData.log || !harData.log.entries) {
                throw new Error('Invalid HAR file structure.');
            }
            allEntries = harData.log.entries;
            // Assign a unique ID to each entry
            allEntries.forEach((entry, index) => {
                entry.__id = 'entry_' + index;
            });
            displayedEntries = allEntries;
            prepareDataForSearch(allEntries);
            displayEntries(displayedEntries);
            makeColumnsResizable();
        } catch (err) {
            alert('Error parsing HAR file: ' + err.message);
            console.error(err);
        }
    };
    reader.readAsText(file);
});