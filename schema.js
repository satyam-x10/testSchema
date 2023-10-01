const crypto = require('crypto');
const fs = require('fs');
const puppeteer = require('puppeteer');


// Replace with the desired number of pages to be scraped (0-100)
const maxPageNumber = 1;

// Function to generate the URL for each page dynamically
function generateURL(pageNumber) {
    const urlElements = {
        domain: "www.topuniversities.com",
        path: [
            "university-rankings",
            "world-university-rankings",
            "2024"
        ],
        queryParams: {
            page: pageNumber, // Set the page number dynamically
        }
    };

    // Construct the URL using the 'urlElements' object
    const { domain, path, queryParams } = urlElements;
    const pathString = path.join('/');
    const queryParamsString = new URLSearchParams(queryParams);


    const generatedURL = `https://${domain}/${pathString}?${queryParamsString}`;
    //generated url will look like    https://www.topuniversities.com/university-rankings/world-university-rankings/2024?page=1

    return generatedURL;
}

// Function to generate unique IDs for each college
function generateUniqueId(collegename) {
    // Using college name to generate id as it most likely won't change
    const id = crypto.createHash('sha256').update(collegename).digest('hex').substr(0, 16);
    return id;
}

// Main function to scrape the data and save it to a JSON file
(async () => {
    console.log('Scraping Data ... please wait ... :) ');
    const allData = [];
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Expose the generateUniqueId function to the page context so that it can be used inside page.evaluate
    await page.exposeFunction('generateUniqueId', generateUniqueId);


    for (let pgno = 0; pgno <= maxPageNumber; pgno++) {
        const url = generateURL(pgno);

        await page.goto(url);
        await page.waitForSelector('.uni-link');

        const pageData = await page.evaluate(async () => {
            const colleges = [];
            const rows = document.querySelectorAll('.api-ranking-css.normal-row');


            // Use Promise.all to await all asynchronous operations inside the loop
            await Promise.all(Array.from(rows).map(async (row, index) => {
                const college = {};
                let collegename = row.querySelector('.uni-link').textContent.trim();

                college.id = await generateUniqueId(collegename);

                college.name = collegename;

                college.score = row.querySelector('.overall-score-span').textContent.trim();


                fullAddress = row.querySelector('.location').textContent.trim();
                const [city, country] = fullAddress.split(',').map(part => part.trim());

                college.city = city;

                college.country = country;
                college.collegePage = row.querySelector('.uni-link').href;



                // Visit the college page to scrape data
                const collegePage = await fetch(college.collegePage);
                const collegePageText = await collegePage.text();
                const collegePageDoc = new DOMParser().parseFromString(collegePageText, 'text/html');


                const tuitionFeeElement = collegePageDoc.querySelector('div.single-badge[data-href="expenses_Tab"] h3');
                if (tuitionFeeElement) {
                    college.tuitionFee = tuitionFeeElement.textContent.trim().replace('Average tuition fee', '');
                } else {
                    college.tuitionFee = 'Not available';
                }

                const undergraduateProgramsElement = collegePageDoc.querySelector('div.single-badge[data-href="ug-tab"] h3');
                let undergraduateProgramsCount = 0;
                if (undergraduateProgramsElement) {
                    undergraduateProgramsCount = parseInt(undergraduateProgramsElement.textContent.trim());
                }
                if (!isNaN(undergraduateProgramsCount)) {
                    college.undergraduatePrograms = undergraduateProgramsCount;
                } else {
                    console.log(`UG Program counts not found on the page for ${college.name}.`);
                }


                colleges.push(college);
            }));

            return colleges;
        });

        allData.push(...pageData);
    }


    await browser.close();

    // Save the colleges with unique IDs to a new JSON file
    const fileName = 'SchemaCourses.json'; // Update with your desired file name
    const jsonData = JSON.stringify(allData, null, 2);

    fs.writeFile(fileName, jsonData, (err) => {
        if (err) {
            console.error('Error writing to the file:', err);
        } else {
            console.log('Colleges data has been saved to', fileName, 'successfully! :)');
        }
    });

    //make a schema file
    const schema = JSON.stringify({
        "id": "string",
        "name": "string",
        "score": "float",
        "city": "string",
        "country": "string",
        "collegePage": "string",
        "tuitionFee": "Optional<string>",
        "undergraduatePrograms": "Optional<int>"
        
    }, null, 2);
    //save schema file
    fs.writeFile('schema.json', schema, (err) => {
        if (err) {
            console.error('Error writing to the file:', err);
        } else {
            console.log('Schema has been saved to schema.json successfully! :)');
        }
    });
})();
