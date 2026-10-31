/**
 * Abnormal thresholds match readingIsAbnormal in monitoringService.
 * Evaluated inside the aggregation so metric documents stay on the server.
 */
export function abnormalExpression() {
  const numeric = {
    $convert: { input: '$value', to: 'double', onError: null, onNull: null },
  };
  return {
    $switch: {
      branches: [
        {
          case: { $eq: ['$metricType', 'custom'] },
          then: { $eq: ['$abnormal', true] },
        },
        {
          case: { $eq: ['$metricType', 'weight'] },
          then: false,
        },
        {
          case: { $eq: ['$metricType', 'blood_pressure'] },
          then: bloodPressureAbnormal(),
        },
        {
          case: { $eq: ['$metricType', 'bmi'] },
          then: {
            $let: {
              vars: { reading: numeric },
              in: {
                $and: [
                  { $ne: ['$$reading', null] },
                  { $or: [{ $lt: ['$$reading', 18.5] }, { $gte: ['$$reading', 30] }] },
                ],
              },
            },
          },
        },
        {
          case: { $eq: ['$metricType', 'a1c'] },
          then: {
            $let: {
              vars: { reading: numeric },
              in: { $and: [{ $ne: ['$$reading', null] }, { $gte: ['$$reading', 7] }] },
            },
          },
        },
        {
          case: { $eq: ['$metricType', 'ldl'] },
          then: ldlAbnormal(numeric),
        },
        {
          case: { $eq: ['$metricType', 'egfr'] },
          then: {
            $let: {
              vars: { reading: numeric },
              in: { $and: [{ $ne: ['$$reading', null] }, { $lt: ['$$reading', 60] }] },
            },
          },
        },
      ],
      default: false,
    },
  };
}

function bloodPressureAbnormal() {
  return {
    $let: {
      vars: {
        parts: { $split: [{ $ifNull: ['$value', ''] }, '/'] },
      },
      in: {
        $let: {
          vars: {
            systolic: {
              $convert: {
                input: { $trim: { input: { $arrayElemAt: ['$$parts', 0] } } },
                to: 'double',
                onError: null,
                onNull: null,
              },
            },
            diastolic: {
              $convert: {
                input: { $trim: { input: { $ifNull: [{ $arrayElemAt: ['$$parts', 1] }, ''] } } },
                to: 'double',
                onError: null,
                onNull: null,
              },
            },
          },
          in: {
            $and: [
              { $ne: ['$$systolic', null] },
              { $ne: ['$$diastolic', null] },
              {
                $or: [
                  { $gte: ['$$systolic', 140] },
                  { $gte: ['$$diastolic', 90] },
                  { $lt: ['$$systolic', 90] },
                  { $lt: ['$$diastolic', 60] },
                ],
              },
            ],
          },
        },
      },
    },
  };
}

function ldlAbnormal(numeric: { $convert: { input: string; to: string; onError: null; onNull: null } }) {
  const milligrams = {
    $regexMatch: { input: { $ifNull: ['$unit', ''] }, regex: 'mg', options: 'i' },
  };
  return {
    $let: {
      vars: { reading: numeric },
      in: {
        $and: [
          { $ne: ['$$reading', null] },
          {
            $cond: [milligrams, { $gte: ['$$reading', 130] }, { $gte: ['$$reading', 3.5] }],
          },
        ],
      },
    },
  };
}
