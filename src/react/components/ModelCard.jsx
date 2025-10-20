import React from "react";
import Button from "./Button";

const ModelCard = ({
  model,
  isSelected,
  isDownloading,
  progress = 0,
  onDownload,
  onSelect,
  onDelete,
  showRadio = false,
  radioName = "model",
  radioValue,
  onRadioChange,
}) => {
  const renderRatingStars = (rating, maxRating = 10) => {
    const stars = 5;
    const filledStars = Math.round((rating / maxRating) * stars);

    return (
      <div className="flex">
        {[...Array(stars)].map((_, i) => (
          <svg
            key={i}
            className={`w-3 h-3 ${
              i < filledStars ? "text-yellow-400 fill-current" : "text-gray-300"
            }`}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  return (
    <div
      className={`border rounded-lg p-4 transition-colors ${
        isSelected
          ? "border-gray-900 bg-gray-50 border-2"
          : "border-gray-50 hover:border-gray-100 bg-gray-50 border-2"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 flex items-center gap-4">
          {/* Radio button for setup */}
          {showRadio && (
            <input
              type="radio"
              name={radioName}
              value={radioValue}
              checked={radioValue === model.id}
              onChange={onRadioChange}
              disabled={!model.downloaded}
              className="focus:outline-none"
            />
          )}

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-medium text-gray-900">
                {model.name}
              </h3>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                {model.language}
              </span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                {model.size}
              </span>
              {model.recommended && (
                <span className="px-2 py-0.5 bg-sky-100 text-sky-800 text-xs rounded">
                  Recommended
                </span>
              )}
              {isSelected && (
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <svg
                    className="w-3 h-3 text-green-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Selected
                </span>
              )}
            </div>

            {/* Ratings */}
            <div className="flex items-center gap-4 mb-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600">Speed</span>
                {renderRatingStars(model.speed)}
                <span className="text-xs font-medium text-gray-900">
                  {model.speed}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600">Accuracy</span>
                {renderRatingStars(model.accuracy)}
                <span className="text-xs font-medium text-gray-900">
                  {model.accuracy}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-600 mb-0">{model.description}</p>

            {/* Download Progress */}
            {isDownloading && (
              <div className="mb-2 mt-2">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-sky-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-4">
          {!model.downloaded && !isDownloading && (
            <button
              className="p-2 text-gray-900 transition-colors"
              onClick={() => onDownload?.(model.id)}
            >
              <i className="ri-download-2-line mr"></i>
            </button>
          )}

          {model.downloaded && !isSelected && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onSelect?.(model.id)}
            >
              Select
            </Button>
          )}

          {/* Delete button - simple bin icon */}
          {model.downloaded && (
            <button
              onClick={() => onDelete?.(model.id)}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Delete model"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelCard;
