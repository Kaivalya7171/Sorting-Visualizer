import tkinter as tk
import random
import time

# Create window
root = tk.Tk()
root.title("Sorting Visualizer")
root.geometry("800x600")

data = []
comparisons = 0  # NEW

# Canvas
canvas = tk.Canvas(root, width=780, height=300, bg="white")
canvas.pack(pady=20)

# Draw bars
def draw_data(data, color_array):
    canvas.delete("all")
    c_height = 300
    c_width = 780
    bar_width = c_width / len(data)

    for i, value in enumerate(data):
        x0 = i * bar_width
        y0 = c_height - value * 2
        x1 = (i + 1) * bar_width
        y1 = c_height

        canvas.create_rectangle(x0, y0, x1, y1, fill=color_array[i])

    root.update_idletasks()

# Generate random data
def generate_data():
    global data
    data = [random.randint(10, 100) for _ in range(30)]
    draw_data(data, ["blue"] * len(data))

# Bubble Sort (UPDATED)
def bubble_sort():
    global data, comparisons
    comparisons = 0

    start_time = time.time()

    n = len(data)
    for i in range(n):
        for j in range(n - i - 1):

            comparisons += 1

            color = ["blue"] * len(data)
            color[j] = "red"
            color[j + 1] = "red"

            draw_data(data, color)
            time.sleep(speed_scale.get())

            if data[j] > data[j + 1]:
                data[j], data[j + 1] = data[j + 1], data[j]

    end_time = time.time()

    draw_data(data, ["green"] * len(data))

    time_label.config(text=f"Time: {end_time - start_time:.2f} sec")
    comp_label.config(text=f"Comparisons: {comparisons}")

# Merge Sort
def merge_sort(data, left, right):
    if left < right:
        mid = (left + right) // 2

        merge_sort(data, left, mid)
        merge_sort(data, mid + 1, right)

        merge(data, left, mid, right)

def merge(data, left, mid, right):
    global comparisons

    left_part = data[left:mid + 1]
    right_part = data[mid + 1:right + 1]

    i = j = 0
    k = left

    while i < len(left_part) and j < len(right_part):

        comparisons += 1

        color = ["blue"] * len(data)
        color[k] = "red"

        draw_data(data, color)
        time.sleep(speed_scale.get())

        if left_part[i] <= right_part[j]:
            data[k] = left_part[i]
            i += 1
        else:
            data[k] = right_part[j]
            j += 1

        k += 1

    while i < len(left_part):
        data[k] = left_part[i]
        i += 1
        k += 1

    while j < len(right_part):
        data[k] = right_part[j]
        j += 1
        k += 1

    draw_data(data, ["blue"] * len(data))

# Algorithm selection
selected_algo = tk.StringVar()
selected_algo.set("Bubble Sort")

algo_menu = tk.OptionMenu(root, selected_algo, "Bubble Sort", "Merge Sort")
algo_menu.pack(pady=5)

# Speed control
speed_scale = tk.Scale(root, from_=0.01, to=1.0, length=200,
                       digits=2, resolution=0.01,
                       orient=tk.HORIZONTAL, label="Speed [s]")
speed_scale.set(0.1)
speed_scale.pack(pady=5)

# NEW: Labels for Step 6
time_label = tk.Label(root, text="Time: 0.00 sec")
time_label.pack()

comp_label = tk.Label(root, text="Comparisons: 0")
comp_label.pack()

# Start sorting
def start_sort():
    global comparisons
    comparisons = 0

    start_time = time.time()

    if selected_algo.get() == "Bubble Sort":
        bubble_sort()

    elif selected_algo.get() == "Merge Sort":
        merge_sort(data, 0, len(data) - 1)
        draw_data(data, ["green"] * len(data))

        end_time = time.time()
        time_label.config(text=f"Time: {end_time - start_time:.2f} sec")
        comp_label.config(text=f"Comparisons: {comparisons}")

# Buttons
generate_btn = tk.Button(root, text="Generate Data", command=generate_data)
generate_btn.pack(pady=10)

sort_btn = tk.Button(root, text="Start Sorting", command=start_sort)
sort_btn.pack(pady=10)

# Run app
root.mainloop()