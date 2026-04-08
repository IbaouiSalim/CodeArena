import type { SnippetExample } from "../types";

export const snippetExamples: SnippetExample[] = [
  // ── Python ────────────────────────────────────
  {
    title: "Hello World",
    language: "python",
    code: `print("Hello, World!")`,
    stdin: "",
  },
  {
    title: "Fibonacci",
    language: "python",
    code: `def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        print(a, end=" ")
        a, b = b, a + b
    print()

fibonacci(15)`,
    stdin: "",
  },
  {
    title: "Interactive Input",
    language: "python",
    code: `name = input("Enter your name: ")
print(f"Hello, {name}!")`,
    stdin: "",
  },
  {
    title: "Bubble Sort",
    language: "python",
    code: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n - i - 1):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
    return arr

numbers = [64, 34, 25, 12, 22, 11, 90]
print("Unsorted:", numbers)
print("Sorted:  ", bubble_sort(numbers))`,
    stdin: "",
  },

  // ── Go ────────────────────────────────────────
  {
    title: "Hello World",
    language: "go",
    code: `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}`,
    stdin: "",
  },
  {
    title: "Fibonacci",
    language: "go",
    code: `package main

import "fmt"

func main() {
    a, b := 0, 1
    for i := 0; i < 15; i++ {
        fmt.Printf("%d ", a)
        a, b = b, a+b
    }
    fmt.Println()
}`,
    stdin: "",
  },
  {
    title: "Interactive Input",
    language: "go",
    code: `package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    fmt.Print("Enter your name: ")
    scanner.Scan()
    fmt.Printf("Hello, %s!\\n", scanner.Text())
}`,
    stdin: "",
  },
  {
    title: "Bubble Sort",
    language: "go",
    code: `package main

import "fmt"

func bubbleSort(arr []int) {
    n := len(arr)
    for i := 0; i < n; i++ {
        for j := 0; j < n-i-1; j++ {
            if arr[j] > arr[j+1] {
                arr[j], arr[j+1] = arr[j+1], arr[j]
            }
        }
    }
}

func main() {
    numbers := []int{64, 34, 25, 12, 22, 11, 90}
    fmt.Println("Unsorted:", numbers)
    bubbleSort(numbers)
    fmt.Println("Sorted:  ", numbers)
}`,
    stdin: "",
  },

  // ── C++ ───────────────────────────────────────
  {
    title: "Hello World",
    language: "cpp",
    code: `#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}`,
    stdin: "",
  },
  {
    title: "Fibonacci",
    language: "cpp",
    code: `#include <iostream>

int main() {
    int a = 0, b = 1;
    for (int i = 0; i < 15; i++) {
        std::cout << a << " ";
        int temp = a;
        a = b;
        b = temp + b;
    }
    std::cout << std::endl;
    return 0;
}`,
    stdin: "",
  },
  {
    title: "Interactive Input",
    language: "cpp",
    code: `#include <iostream>
#include <string>

int main() {
    std::string name;
    std::cout << "Enter your name: ";
    std::getline(std::cin, name);
    std::cout << "Hello, " << name << "!" << std::endl;
    return 0;
}`,
    stdin: "",
  },
  {
    title: "Bubble Sort",
    language: "cpp",
    code: `#include <iostream>
#include <vector>

void bubbleSort(std::vector<int>& arr) {
    int n = arr.size();
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                std::swap(arr[j], arr[j + 1]);
            }
        }
    }
}

void printVec(const std::vector<int>& v) {
    for (int x : v) std::cout << x << " ";
    std::cout << std::endl;
}

int main() {
    std::vector<int> numbers = {64, 34, 25, 12, 22, 11, 90};
    std::cout << "Unsorted: "; printVec(numbers);
    bubbleSort(numbers);
    std::cout << "Sorted:   "; printVec(numbers);
    return 0;
}`,
    stdin: "",
  },

  // ── Rust ──────────────────────────────────────
  {
    title: "Hello World",
    language: "rust",
    code: `fn main() {
    println!("Hello, World!");
}`,
    stdin: "",
  },
  {
    title: "Fibonacci",
    language: "rust",
    code: `fn main() {
    let (mut a, mut b) = (0u64, 1u64);
    for _ in 0..15 {
        print!("{} ", a);
        let temp = a;
        a = b;
        b = temp + b;
    }
    println!();
}`,
    stdin: "",
  },
  {
    title: "Interactive Input",
    language: "rust",
    code: `use std::io;

fn main() {
    println!("Enter your name:");
    let mut name = String::new();
    io::stdin().read_line(&mut name).unwrap();
    println!("Hello, {}!", name.trim());
}`,
    stdin: "",
  },
  {
    title: "Bubble Sort",
    language: "rust",
    code: `fn bubble_sort(arr: &mut Vec<i32>) {
    let n = arr.len();
    for i in 0..n {
        for j in 0..n - i - 1 {
            if arr[j] > arr[j + 1] {
                arr.swap(j, j + 1);
            }
        }
    }
}

fn main() {
    let mut numbers = vec![64, 34, 25, 12, 22, 11, 90];
    println!("Unsorted: {:?}", numbers);
    bubble_sort(&mut numbers);
    println!("Sorted:   {:?}", numbers);
}`,
    stdin: "",
  },

  // ── JavaScript ────────────────────────────────
  {
    title: "Hello World",
    language: "javascript",
    code: 'console.log("Hello, World!");',
    stdin: "",
  },
  {
    title: "Fibonacci",
    language: "javascript",
    code: `function fibonacci(n) {
  let a = 0, b = 1;
  const result = [];
  for (let i = 0; i < n; i++) {
    result.push(a);
    [a, b] = [b, a + b];
  }
  return result;
}

console.log(fibonacci(15).join(" "));`,
    stdin: "",
  },
  {
    title: "Interactive Input",
    language: "javascript",
    code: "const readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin, output: process.stdout });\n\nrl.question('Enter your name: ', (name) => {\n  console.log(`Hello, ${name}!`);\n  rl.close();\n});",
    stdin: "",
  },
  {
    title: "Bubble Sort",
    language: "javascript",
    code: `function bubbleSort(arr) {
  const n = arr.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}

const numbers = [64, 34, 25, 12, 22, 11, 90];
console.log("Unsorted:", numbers.join(" "));
console.log("Sorted:  ", bubbleSort([...numbers]).join(" "));`,
    stdin: "",
  },
];
