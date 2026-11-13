# Exercise photographs

Source: https://github.com/yuhonas/free-exercise-db
The source repository distributes this dataset under the Unlicense.
Exact mappings are recorded in src/avalen/exercise-images.json. Walking lunge uses the dumbbell lunge photograph. Custom exercises use a coach photograph or a clearly labelled group cover until attached.
Each built-in exercise also has the dataset's second position photograph (`<name>-0.jpg`, from the exercise's `0.jpg`). The app crossfades the two to show the movement; the source of each is recorded as `frameSource`.

## Built-in exercise catalogue

`library/` holds the two position photographs (`<name>-0.webp`, `<name>-1.webp`) for each of the roughly 300 catalogue exercises in `src/avalen/exercise-catalogue-data.js`, from the same dataset and licence. They were resized to 560 px wide and converted to WebP. Each catalogue row records its source exercise folder as `source`.
