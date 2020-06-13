const {
    getConfig
} = require('./config');

/**
 * @param  {boolean} frontend // whether or not this is an front or admin call
 * @param  {req} req // express `req` object
 * @param  {integer} page // The page number
 * @param  {string} collection // The collection to search
 * @param  {object} query // The mongo query
 * @param  {object} sort // The mongo sort
 */
const paginateData = (frontend, req, page, collection, query, sort) => {
    const db = req.app.db;
    const config = getConfig();
    let numberItems = 10;
    if(frontend){
        numberItems = config.productsPerPage ? config.productsPerPage : 6;
    }

    let skip = 0;
    if(page > 1){
        skip = (page - 1) * numberItems;
    }

    if(!query){
        query = {};
    }
    if(!sort){
        sort = {};
    }

    // Run our queries
    return Promise.all([
        db[collection].find(query).skip(skip).limit(parseInt(numberItems)).sort(sort).toArray(),
        db[collection].countDocuments(query)
    ])
    .then((result) => {
        const returnData = { data: result[0], totalItems: result[1] };
        return returnData;
    })
    .catch((err) => {
        throw new Error('Error retrieving paginated data');
    });
};

/**
 * @param  {boolean} frontend // whether or not this is an front or admin call
 * @param  {req} req // express `req` object
 * @param  {integer} page // The page number
 * @param  {string} collection // The collection to search
 * @param  {object} query // The mongo query
 * @param  {object} sort // The mongo sort
 */
const paginateProducts = (frontend, db, page, query, sort) => {
    const config = getConfig();
    let numberItems = 10;
    if(frontend){
        numberItems = config.productsPerPage ? config.productsPerPage : 6;
    }

    let skip = 0;
    if(page > 1){
        skip = (page - 1) * numberItems;
    }

    if(!query){
        query = {};
    }
    if(!sort){
        sort = {};
    }

    // Run our queries
    return Promise.all([
        db.products.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'variants',
                    localField: '_id',
                    foreignField: 'product',
                    as: 'variants'
                }
            }
        ]).sort(sort).skip(skip).limit(parseInt(numberItems)).toArray(),
        db.products.countDocuments(query)
    ])
    .then((result) => {
        const returnData = { data: result[0], totalItems: result[1] };
        return returnData;
    })
    .catch((err) => {
        throw new Error('Error retrieving paginated data');
    });
};

const getSort = () => {
    const config = getConfig();
    let sortOrder = -1;
    if(config.productOrder === 'ascending'){
        sortOrder = 1;
    }
    let sortField = 'productAddedDate';
    if(config.productOrderBy === 'title'){
        sortField = 'productTitle';
    }

    return {
        [sortField]: sortOrder
    };
};

module.exports = {
    paginateData,
    paginateProducts,
    getSort
};
